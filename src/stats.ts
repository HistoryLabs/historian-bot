import type { RESTGetAPICurrentUserGuildsResult } from 'discord-api-types/v10';
import { aboutMe } from './config';
import { DiscordError, discordRequest } from './discord';
import type { Env } from './env';

export interface Stats {
    guilds: number;
    members: number;
    updatedAt: number; // unix seconds
}

/**
 * Daily job: counts servers and members, saves them for GET /stats, then
 * updates top.gg and the bot's About Me. Each step runs even if an earlier one fails.
 */
export async function updateStats(env: Env, now: number): Promise<Stats> {
    const stats = { ...(await countGuilds(env)), updatedAt: Math.floor(now / 1000) };

    await env.DB.prepare(
        `INSERT INTO stats (id, guild_count, member_count, updated_at) VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
            guild_count = excluded.guild_count,
            member_count = excluded.member_count,
            updated_at = excluded.updated_at`,
    )
        .bind(stats.guilds, stats.members, stats.updatedAt)
        .run();

    const servers = new Intl.NumberFormat('en-US').format(stats.guilds);
    const results = await Promise.allSettled([
        postTopggStats(env, stats.guilds),
        discordRequest(env, 'PATCH', '/applications/@me', { description: aboutMe(servers) }),
    ]);
    for (const result of results) {
        if (result.status === 'rejected') console.error('Stats update step failed', result.reason);
    }

    return stats;
}

export async function getStats(db: D1Database): Promise<Stats | null> {
    return db
        .prepare(
            'SELECT guild_count AS guilds, member_count AS members, updated_at AS updatedAt FROM stats WHERE id = 1',
        )
        .first<Stats>();
}

/** Pages through every server the bot is in (200 at a time) and adds up their approximate member counts. */
async function countGuilds(env: Env): Promise<{ guilds: number; members: number }> {
    let guilds = 0;
    let members = 0;
    let after = '0';

    while (true) {
        const page = await withRetry(() =>
            discordRequest(env, 'GET', `/users/@me/guilds?with_counts=true&limit=200&after=${after}`),
        ).then((res) => res.json<RESTGetAPICurrentUserGuildsResult>());

        guilds += page.length;
        for (const guild of page) members += guild.approximate_member_count ?? 0;
        if (page.length < 200) return { guilds, members };
        after = page[page.length - 1].id;
    }
}

/** Retries a Discord request after the wait Discord asks for when rate limited. */
async function withRetry(request: () => Promise<Response>, attempts = 3): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await request();
        } catch (err) {
            if (!(err instanceof DiscordError) || err.status !== 429 || attempt === attempts) throw err;
            await new Promise((resolve) => setTimeout(resolve, err.retryAfter * 1000));
        }
    }
}

async function postTopggStats(env: Env, guilds: number): Promise<void> {
    // Only set in production, so dev bots and forks don't report to the real listing
    if (!env.TOPGG_TOKEN) return;

    const response = await fetch(`https://top.gg/api/bots/${env.DISCORD_APPLICATION_ID}/stats`, {
        method: 'POST',
        headers: { Authorization: env.TOPGG_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_count: guilds }),
    });
    if (!response.ok) throw new Error(`top.gg returned ${response.status}: ${await response.text()}`);
}
