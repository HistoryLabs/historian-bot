import { addDays, format, parse } from 'date-fns';
import type { Subscription } from './db';
import type { Env } from './env';
import type { PostMessage } from './posts';
import { nextSendAt, zonedDate } from './timezones';
import { warmEvents } from './wiki';

// Free-plan D1 allows 50 queries per invocation, so everything here is a
// fixed number of queries regardless of how many posts are due.

/**
 * Queues every post whose time has come and moves its schedule forward.
 * Runs from the cron trigger. Returns how many posts were queued.
 */
export async function enqueueDuePosts(env: Pick<Env, 'DB' | 'POSTS'>, now: number): Promise<number> {
    const { results: due } = await env.DB.prepare(
        'SELECT * FROM subscriptions WHERE next_send_at <= ? ORDER BY next_send_at LIMIT 1000',
    )
        .bind(Math.floor(now / 1000))
        .all<Subscription>();
    if (due.length === 0) return 0;

    // Each post is for the date it was scheduled on, in the server's time zone,
    // even if this run is late
    const posts: PostMessage[] = due.map((sub) => ({
        guildId: sub.guild_id,
        kind: sub.kind,
        channelId: sub.channel_id,
        date: format(zonedDate(sub.timezone, sub.next_send_at * 1000), 'yyyy-MM-dd'),
    }));

    await warmEvents(env.DB, datesNeeded(posts), now);

    for (let i = 0; i < posts.length; i += 100) {
        await env.POSTS.sendBatch(posts.slice(i, i + 100).map((body) => ({ body })));
    }

    // Only move rows that haven't been changed by /schedule since we read them.
    // Missed runs (e.g. after an outage) are sent once, then skip ahead to the next future time.
    const updates = due.map((sub) => ({
        guild: sub.guild_id,
        kind: sub.kind,
        prev: sub.next_send_at,
        next: Math.floor(nextSendAt(sub, now) / 1000),
    }));
    await env.DB.prepare(
        `UPDATE subscriptions SET next_send_at = u.value ->> 'next'
             FROM json_each(?) AS u
             WHERE subscriptions.guild_id = u.value ->> 'guild'
               AND subscriptions.kind = u.value ->> 'kind'
               AND subscriptions.next_send_at = u.value ->> 'prev'`,
    )
        .bind(JSON.stringify(updates))
        .run();

    return posts.length;
}

/** Every calendar date the queued posts will need events for. */
function datesNeeded(posts: PostMessage[]): { month: number; day: number }[] {
    const dates = new Map<string, Date>();
    for (const post of posts) {
        const start = parse(post.date, 'yyyy-MM-dd', new Date());
        const days = post.kind === 'weekly' ? 7 : 1;
        for (let i = 0; i < days; i++) {
            const date = addDays(start, i);
            dates.set(format(date, 'MM-dd'), date);
        }
    }
    return [...dates.values()].map((date) => ({ month: date.getMonth() + 1, day: date.getDate() }));
}
