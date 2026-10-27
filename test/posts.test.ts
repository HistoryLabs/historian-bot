import { createExecutionContext, createMessageBatch, env, getQueueResult } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Subscription, upsertSubscription } from '../src/db';
import worker from '../src/index';
import type { PostMessage } from '../src/posts';
import { mockFetch } from './helpers';

afterEach(async () => {
    vi.restoreAllMocks();
    await env.DB.exec('DELETE FROM subscriptions; DELETE FROM wiki_days;');
});

const GUILD = '777';
const CHANNEL = '888';
const SEND_URL = `https://discord.com/api/v10/channels/${CHANNEL}/messages`;

async function schedule(fields: Partial<Subscription> = {}) {
    await upsertSubscription(env.DB, {
        guild_id: GUILD,
        kind: 'daily',
        channel_id: CHANNEL,
        role_id: null,
        timezone: 'America/Chicago',
        hour: 12,
        weekday: null,
        next_send_at: 0,
        ...fields,
    });
}

/** Runs the queue consumer on the given posts and returns what it acked and retried. */
async function consume(...posts: PostMessage[]) {
    const batch = createMessageBatch<PostMessage>('historian-posts', posts.map((body, i) => ({
        id: String(i),
        timestamp: Date.now(),
        attempts: 1,
        body,
    })));
    // getQueueResult doesn't report retry delays, so record them directly
    const retryDelays: Record<string, number | undefined> = {};
    for (const message of batch.messages) {
        const retry = message.retry.bind(message);
        message.retry = options => {
            retryDelays[message.id] = options?.delaySeconds;
            retry(options);
        };
    }
    const ctx = createExecutionContext();
    await worker.queue(batch, env);
    return { ...await getQueueResult(batch, ctx), retryDelays };
}

const daily: PostMessage = { guildId: GUILD, kind: 'daily', channelId: CHANNEL, date: '2026-10-24' };
const weekly: PostMessage = { guildId: GUILD, kind: 'weekly', channelId: CHANNEL, date: '2026-10-26' };

describe('sending posts', () => {
    it('sends a daily post and pings the role', async () => {
        const calls = mockFetch({ wikimediaYears: [1945] });
        await schedule({ role_id: '999' });

        const result = await consume(daily);
        expect(result.explicitAcks).toEqual(['0']);

        const send = calls.find(c => c.url === SEND_URL)!;
        expect(send.headers.get('Authorization')).toBe('Bot test-token');
        expect(send.body.content).toBe('<@&999>');
        expect(send.body.allowed_mentions).toEqual({ roles: ['999'] });
        expect(send.body.embeds[0].title).toBe('Wednesday, October 24th, 1945');
        expect(send.body.embeds[0].footer.text).toBe('Daily Events • Randomly selected from 1 events');
    });

    it('sends a weekly post with one event per day', async () => {
        const calls = mockFetch({ wikimediaYears: [1900, 1950] });
        // Pinging the @everyone role (its ID is the server's ID)
        await schedule({ kind: 'weekly', weekday: 1, role_id: GUILD });

        await consume(weekly);

        const send = calls.find(c => c.url === SEND_URL)!;
        expect(send.body.content).toBe('@everyone');
        expect(send.body.allowed_mentions).toEqual({ parse: ['everyone'] });
        const embed = send.body.embeds[0];
        expect(embed.title).toBe('Events this week (October 26th - November 1st)');
        expect(embed.description.split('\n\n')).toHaveLength(7);
        expect(embed.description).toMatch(/^\*\*\[Monday, October 26th \((1900|1950)\)\]/);
        expect(embed.footer.text).toBe('Weekly Events • Randomly selected from an average of 2 events per day');
        // Each date is fetched once
        expect(calls.filter(c => c.url.startsWith('https://api.wikimedia.org/'))).toHaveLength(7);
    });

    it('does not ping anyone without a role', async () => {
        const calls = mockFetch();
        await schedule();
        await consume(daily);
        const send = calls.find(c => c.url === SEND_URL)!;
        expect(send.body.content).toBeUndefined();
        expect(send.body.allowed_mentions).toEqual({ parse: [] });
    });

    it('skips posts for stopped or moved schedules', async () => {
        const calls = mockFetch();
        await schedule({ channel_id: 'somewhere-else' });

        const result = await consume(daily, weekly);
        expect(result.explicitAcks.sort()).toEqual(['0', '1']);
        expect(calls).toHaveLength(0);
    });

    it('retries after the time Discord asks for when rate limited', async () => {
        mockFetch();
        vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
            const url = new Request(input).url;
            if (url.startsWith('https://api.wikimedia.org/')) return Response.json({ events: [{ year: 1945, text: 'x', pages: [] }] });
            return new Response(JSON.stringify({ message: 'You are being rate limited.', retry_after: 2.5 }), { status: 429 });
        });
        await schedule();

        const result = await consume(daily);
        expect(result.retryMessages).toEqual([{ msgId: '0' }]);
        expect(result.retryDelays).toEqual({ '0': 3 });
    });

    it('removes the schedule when the bot can no longer post in the channel', async () => {
        mockFetch({ discordStatus: () => 403 });
        vi.spyOn(console, 'log').mockImplementation(() => {});
        await schedule();

        const result = await consume(daily);
        expect(result.explicitAcks).toEqual(['0']);
        expect(await env.DB.prepare('SELECT * FROM subscriptions WHERE guild_id = ?').bind(GUILD).first()).toBeNull();
    });

    it('retries other failures', async () => {
        mockFetch({ discordStatus: () => 500 });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await schedule();

        const result = await consume(daily);
        expect(result.retryMessages).toEqual([{ msgId: '0' }]);
        expect(result.retryDelays).toEqual({ '0': 60 });
        expect(await env.DB.prepare('SELECT * FROM subscriptions WHERE guild_id = ?').bind(GUILD).first()).not.toBeNull();
    });
});
