import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Subscription, upsertSubscription } from '../src/db';
import type { PostMessage } from '../src/posts';
import { enqueueDuePosts } from '../src/scheduler';
import { mockFetch } from './helpers';

const at = (iso: string) => Date.parse(iso) / 1000;

afterEach(async () => {
    vi.restoreAllMocks();
    await env.DB.exec('DELETE FROM subscriptions; DELETE FROM wiki_days;');
});

function subscription(guildId: string, fields: Partial<Subscription>): Subscription {
    return {
        guild_id: guildId,
        kind: 'daily',
        channel_id: `channel-${guildId}`,
        role_id: null,
        timezone: 'America/Chicago',
        hour: 12,
        weekday: null,
        next_send_at: 0,
        ...fields,
    };
}

/** A stand-in for the POSTS queue that records what was sent. */
function fakeQueue(onSend?: () => Promise<void>) {
    const sent: PostMessage[] = [];
    const queue = {
        sendBatch: vi.fn<(messages: Iterable<MessageSendRequest<PostMessage>>) => Promise<void>>(async (messages) => {
            for (const m of messages) sent.push(m.body);
            await onSend?.();
        }),
    } as unknown as Queue<PostMessage>;
    return { queue, sent };
}

async function nextSendAt(guildId: string, kind = 'daily') {
    return env.DB.prepare('SELECT next_send_at FROM subscriptions WHERE guild_id = ? AND kind = ?')
        .bind(guildId, kind)
        .first<number>('next_send_at');
}

describe('enqueueDuePosts', () => {
    const now = Date.parse('2026-10-24T17:00:00Z'); // Saturday, 12 PM in Chicago

    it('queues due posts for their local date and moves them forward', async () => {
        const calls = mockFetch({ wikimediaYears: [1945] });
        // Due now: Chicago noon
        await upsertSubscription(env.DB, subscription('chicago', { next_send_at: at('2026-10-24T17:00:00Z') }));
        // Due an hour ago: 1 AM in Tokyo, which is already the 25th there
        await upsertSubscription(
            env.DB,
            subscription('tokyo', { timezone: 'Asia/Tokyo', hour: 1, next_send_at: at('2026-10-24T16:00:00Z') }),
        );
        // Missed last Monday's weekly post (e.g. an outage)
        await upsertSubscription(
            env.DB,
            subscription('missed', { kind: 'weekly', weekday: 1, next_send_at: at('2026-10-19T17:00:00Z') }),
        );
        // Not due yet
        await upsertSubscription(env.DB, subscription('later', { next_send_at: at('2026-10-24T18:00:00Z') }));

        const { queue, sent } = fakeQueue();
        expect(await enqueueDuePosts({ DB: env.DB, POSTS: queue }, now)).toBe(3);

        expect(sent).toEqual(
            expect.arrayContaining([
                { guildId: 'chicago', kind: 'daily', channelId: 'channel-chicago', date: '2026-10-24' },
                { guildId: 'tokyo', kind: 'daily', channelId: 'channel-tokyo', date: '2026-10-25' },
                { guildId: 'missed', kind: 'weekly', channelId: 'channel-missed', date: '2026-10-19' },
            ]),
        );
        expect(sent).toHaveLength(3);

        expect(await nextSendAt('chicago')).toBe(at('2026-10-25T17:00:00Z'));
        expect(await nextSendAt('tokyo')).toBe(at('2026-10-25T16:00:00Z'));
        // Skips ahead to the next future Monday instead of sending every missed week
        expect(await nextSendAt('missed', 'weekly')).toBe(at('2026-10-26T17:00:00Z'));
        expect(await nextSendAt('later')).toBe(at('2026-10-24T18:00:00Z'));

        // Warmed the cache for every date needed: Oct 19th-25th
        const warmed = calls
            .filter((c) => c.url.startsWith('https://api.wikimedia.org/'))
            .map((c) => c.url.slice(-5))
            .toSorted();
        expect(warmed).toEqual(['10/19', '10/20', '10/21', '10/22', '10/23', '10/24', '10/25']);
    });

    it('does nothing when no posts are due', async () => {
        await upsertSubscription(env.DB, subscription('later', { next_send_at: at('2026-10-24T18:00:00Z') }));
        const { queue } = fakeQueue();
        expect(await enqueueDuePosts({ DB: env.DB, POSTS: queue }, now)).toBe(0);
        expect(queue.sendBatch).not.toHaveBeenCalled();
    });

    it('keeps a schedule that was changed while the run was in progress', async () => {
        mockFetch();
        await upsertSubscription(env.DB, subscription('changed', { next_send_at: at('2026-10-24T17:00:00Z') }));

        // Someone runs /schedule daily time:8 while the posts are being queued
        const { queue } = fakeQueue(() =>
            upsertSubscription(env.DB, subscription('changed', { hour: 8, next_send_at: at('2026-10-25T13:00:00Z') })),
        );
        await enqueueDuePosts({ DB: env.DB, POSTS: queue }, now);

        expect(await nextSendAt('changed')).toBe(at('2026-10-25T13:00:00Z'));
    });

    it('still queues posts if Wikipedia is down', async () => {
        mockFetch({ wikimediaStatus: 503 });
        await upsertSubscription(env.DB, subscription('chicago', { next_send_at: at('2026-10-24T17:00:00Z') }));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const { queue, sent } = fakeQueue();
        await enqueueDuePosts({ DB: env.DB, POSTS: queue }, now);
        expect(sent).toHaveLength(1);
    });
});
