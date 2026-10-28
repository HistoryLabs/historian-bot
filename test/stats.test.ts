import { createExecutionContext, createScheduledController, env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { updateStats } from '../src/stats';
import type { RecordedCall } from './helpers';

afterEach(async () => {
    vi.restoreAllMocks();
    await env.DB.exec('DELETE FROM stats;');
});

const now = Date.parse('2026-10-27T06:00:00Z');

/** Fake guild list: `count` servers with 10 members each. */
const guilds = (count: number, start = 0) =>
    Array.from({ length: count }, (_, i) => ({ id: String(1000 + start + i), approximate_member_count: 10 }));

/**
 * Mocks Discord and top.gg. Guild pages come from `pages` in order;
 * `status` can fail a URL with an HTTP status.
 */
function mockApis(pages: unknown[][], status: (url: string) => number = () => 200) {
    const calls: RecordedCall[] = [];
    let page = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const request = new Request(input, init);
        const text = await request.text();
        calls.push({
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: text ? JSON.parse(text) : null,
        });

        const code = status(request.url);
        if (code !== 200)
            return new Response(JSON.stringify({ message: 'error', retry_after: 0.01 }), { status: code });
        if (request.url.includes('/users/@me/guilds')) return Response.json(pages[page++] ?? []);
        return Response.json({});
    });
    return calls;
}

describe('updateStats', () => {
    it('counts servers and members across pages and saves them', async () => {
        const calls = mockApis([guilds(200), guilds(5, 200)]);

        expect(await updateStats({ ...env, TOPGG_TOKEN: 'topgg-token' }, now)).toEqual({
            guilds: 205,
            members: 2050,
            updatedAt: now / 1000,
        });

        const pageUrls = calls
            .filter((c) => c.url.includes('/users/@me/guilds'))
            .map((c) => new URL(c.url).searchParams.get('after'));
        expect(pageUrls).toEqual(['0', '1199']);

        const topgg = calls.find((c) => c.url.startsWith('https://top.gg/'))!;
        expect(topgg.url).toBe(`https://top.gg/api/bots/${env.DISCORD_APPLICATION_ID}/stats`);
        expect(topgg.headers.get('Authorization')).toBe('topgg-token');
        expect(topgg.body).toEqual({ server_count: 205 });

        const about = calls.find((c) => c.url.endsWith('/applications/@me'))!;
        expect(about.method).toBe('PATCH');
        expect(about.body.description).toContain('Serving 205 servers');
        expect(about.body.description.length).toBeLessThanOrEqual(400);
    });

    it('skips top.gg without a token', async () => {
        const calls = mockApis([guilds(3)]);
        await updateStats(env, now);
        expect(calls.some((c) => c.url.startsWith('https://top.gg/'))).toBe(false);
    });

    it('still updates the About Me if top.gg fails', async () => {
        const calls = mockApis([guilds(3)], (url) => (url.startsWith('https://top.gg/') ? 500 : 200));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await updateStats({ ...env, TOPGG_TOKEN: 'topgg-token' }, now);
        expect(calls.some((c) => c.url.endsWith('/applications/@me'))).toBe(true);
    });

    it('waits and retries when rate limited', async () => {
        let limited = false;
        const calls = mockApis([guilds(3)], (url) => {
            if (url.includes('/users/@me/guilds') && !limited) {
                limited = true;
                return 429;
            }
            return 200;
        });

        expect((await updateStats(env, now)).guilds).toBe(3);
        expect(calls.filter((c) => c.url.includes('/users/@me/guilds'))).toHaveLength(2);
    });
});

describe('scheduled runs', () => {
    it('runs the stats job only on the daily cron', async () => {
        const calls = mockApis([guilds(3)]);
        vi.spyOn(console, 'log').mockImplementation(() => {});

        await worker.scheduled(createScheduledController({ cron: '*/15 * * * *', scheduledTime: now }), env);
        expect(calls).toHaveLength(0);

        await worker.scheduled(createScheduledController({ cron: '0 6 * * *', scheduledTime: now }), env);
        expect(calls.some((c) => c.url.includes('/users/@me/guilds'))).toBe(true);
    });
});

async function fetchStats() {
    const request = new Request('https://bot.test/stats') as Request<unknown, IncomingRequestCfProperties>;
    return worker.fetch(request, env, createExecutionContext());
}

describe('GET /stats', () => {
    it('returns 503 before the first run', async () => {
        const response = await fetchStats();
        expect(response.status).toBe(503);
    });

    it('returns the saved stats with CORS headers', async () => {
        mockApis([guilds(4)]);
        await updateStats(env, now);

        const response = await fetchStats();
        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(await response.json()).toEqual({ guilds: 4, members: 40, updatedAt: now / 1000 });
    });
});
