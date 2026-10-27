import { addDays, format, parse } from 'date-fns';
import { AllowedMentionsTypes, type APIAllowedMentions, type APIEmbed } from 'discord-api-types/v10';
import { FOOTER } from './config';
import type { ScheduleKind } from './db';
import { DiscordError, discordRequest, embed, truncate } from './discord';
import type { Env } from './env';
import { type HistoricalEvent, formatYear, getEvents, historicalWeekday, pickRandom } from './wiki';

/** One scheduled post, queued by the cron and sent by the queue consumer. */
export interface PostMessage {
    guildId: string;
    kind: ScheduleKind;
    channelId: string;
    date: string; // 'yyyy-MM-dd' the post is for, in the server's time zone
}

/** Embed for one event that happened on `date` (month and day only; the year is ignored). */
export function eventEmbed(date: Date, event: HistoricalEvent, footer: string): APIEmbed {
    const weekday = historicalWeekday(event.year, date.getMonth() + 1, date.getDate());
    return embed({
        title: `${weekday ? `${weekday}, ` : ''}${format(date, 'MMMM do')}, ${formatYear(event.year)}`,
        url: event.url,
        description: event.text,
        footer: { ...FOOTER, text: footer },
    });
}

type EventLoader = (date: Date) => Promise<HistoricalEvent[]>;

async function dailyEmbed(date: Date, load: EventLoader): Promise<APIEmbed> {
    const events = await load(date);
    if (events.length === 0) throw new Error(`No events for ${format(date, 'MM-dd')}`);
    return eventEmbed(date, pickRandom(events), `Daily Events • Randomly selected from ${events.length} events`);
}

async function weeklyEmbed(start: Date, load: EventLoader): Promise<APIEmbed> {
    const lines: string[] = [];
    let total = 0;

    for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        const events = await load(date);
        total += events.length;
        if (events.length === 0) continue;

        const event = pickRandom(events);
        lines.push(`**[${format(date, 'EEEE, MMMM do')} (${formatYear(event.year)})](${event.url})** - ${truncate(event.text, 450)}`);
    }
    if (lines.length === 0) throw new Error(`No events for the week of ${format(start, 'MM-dd')}`);

    return embed({
        title: `Events this week (${format(start, 'MMMM do')} - ${format(addDays(start, 6), 'MMMM do')})`,
        description: lines.join('\n\n'),
        footer: { ...FOOTER, text: `Weekly Events • Randomly selected from an average of ${Math.round(total / 7)} events per day` },
    });
}

/**
 * Queue consumer: sends each post to its channel.
 *
 * Posts are skipped if the schedule was stopped or moved after they were queued.
 * A channel the bot can no longer post in has its schedule removed.
 */
export async function sendPosts(batch: MessageBatch<PostMessage>, env: Env, now = Date.now()): Promise<void> {
    // One query for every schedule in the batch, to stay under D1's per-invocation limit
    const { results } = await env.DB
        .prepare(
            `SELECT s.guild_id, s.kind, s.channel_id, s.role_id FROM subscriptions s
             JOIN json_each(?) AS m ON s.guild_id = m.value ->> 'guildId' AND s.kind = m.value ->> 'kind'`,
        )
        .bind(JSON.stringify(batch.messages.map(m => m.body)))
        .all<{ guild_id: string, kind: ScheduleKind, channel_id: string, role_id: string | null }>();
    const schedules = new Map(results.map(r => [`${r.guild_id}:${r.kind}`, r]));

    // Posts in a batch often share dates, so load each one once
    const loaded = new Map<string, Promise<HistoricalEvent[]>>();
    const load: EventLoader = date => {
        const key = format(date, 'MM-dd');
        let events = loaded.get(key);
        if (!events) {
            events = getEvents(env.DB, date.getMonth() + 1, date.getDate(), now);
            loaded.set(key, events);
        }
        return events;
    };

    for (const message of batch.messages) {
        const post = message.body;
        const schedule = schedules.get(`${post.guildId}:${post.kind}`);
        if (!schedule || schedule.channel_id !== post.channelId) {
            message.ack();
            continue;
        }

        try {
            const date = parse(post.date, 'yyyy-MM-dd', new Date());
            const postEmbed = post.kind === 'daily' ? await dailyEmbed(date, load) : await weeklyEmbed(date, load);
            await discordRequest(env, 'POST', `/channels/${post.channelId}/messages`, {
                ...mention(schedule.role_id, post.guildId),
                embeds: [postEmbed],
            });
            message.ack();
        } catch (err) {
            if (err instanceof DiscordError && err.status === 429) {
                message.retry({ delaySeconds: retryAfter(err) });
            } else if (err instanceof DiscordError && (err.status === 403 || err.status === 404)) {
                // Channel deleted or the bot lost access
                await env.DB
                    .prepare('DELETE FROM subscriptions WHERE guild_id = ? AND kind = ? AND channel_id = ?')
                    .bind(post.guildId, post.kind, post.channelId)
                    .run();
                console.log(`Removed ${post.kind} schedule for guild ${post.guildId}: Discord returned ${err.status}`);
                message.ack();
            } else {
                console.error(`Failed to send ${post.kind} post to ${post.channelId}`, err);
                message.retry({ delaySeconds: 60 });
            }
        }
    }
}

function mention(roleId: string | null, guildId: string): { content?: string, allowed_mentions: APIAllowedMentions } {
    if (!roleId) return { allowed_mentions: { parse: [] } };
    // The @everyone role has the same ID as the server
    if (roleId === guildId) return { content: '@everyone', allowed_mentions: { parse: [AllowedMentionsTypes.Everyone] } };
    return { content: `<@&${roleId}>`, allowed_mentions: { roles: [roleId] } };
}

/** Seconds to wait from a 429 response, at least 1. */
function retryAfter(err: DiscordError): number {
    try {
        return Math.max(1, Math.ceil(JSON.parse(err.body).retry_after));
    } catch {
        return 5;
    }
}
