export type ScheduleKind = 'daily' | 'weekly';

export interface Subscription {
    guild_id: string;
    kind: ScheduleKind;
    channel_id: string;
    role_id: string | null;
    timezone: string;
    hour: number;
    weekday: number | null;
    next_send_at: number;
}

export async function getSubscriptions(db: D1Database, guildId: string): Promise<Subscription[]> {
    const { results } = await db
        .prepare('SELECT * FROM subscriptions WHERE guild_id = ? ORDER BY kind')
        .bind(guildId)
        .all<Subscription>();
    return results;
}

export async function getGuildTimezone(db: D1Database, guildId: string): Promise<string | null> {
    return db
        .prepare("SELECT timezone FROM subscriptions WHERE guild_id = ? ORDER BY kind = 'daily' DESC LIMIT 1")
        .bind(guildId)
        .first<string>('timezone');
}

export async function upsertSubscription(db: D1Database, sub: Subscription): Promise<void> {
    await db
        .prepare(
            `INSERT INTO subscriptions (guild_id, kind, channel_id, role_id, timezone, hour, weekday, next_send_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (guild_id, kind) DO UPDATE SET
                channel_id = excluded.channel_id,
                role_id = excluded.role_id,
                timezone = excluded.timezone,
                hour = excluded.hour,
                weekday = excluded.weekday,
                next_send_at = excluded.next_send_at`,
        )
        .bind(
            sub.guild_id,
            sub.kind,
            sub.channel_id,
            sub.role_id,
            sub.timezone,
            sub.hour,
            sub.weekday,
            sub.next_send_at,
        )
        .run();
}

export async function deleteSubscription(db: D1Database, guildId: string, kind: ScheduleKind): Promise<boolean> {
    const result = await db
        .prepare('DELETE FROM subscriptions WHERE guild_id = ? AND kind = ?')
        .bind(guildId, kind)
        .run();
    return result.meta.changes > 0;
}
