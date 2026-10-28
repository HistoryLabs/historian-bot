// Converts the old bot's Mongo `guilds` collection into SQL for the D1 `subscriptions` table.
//
//   npm run import-mongo -- guilds.json > import.sql
//   npx wrangler d1 execute historian --remote --file import.sql
//
// Accepts mongoexport output (one document per line, or --jsonArray) and bsondump
// output, in relaxed or canonical Extended JSON. Old schedules were all in US Central
// time, and weekly posts went out on Mondays. A summary is printed to stderr.
import { readFileSync } from 'node:fs';
import { nextSendAt } from '../src/timezones.ts';

const TIMEZONE = 'America/Chicago';
const MONDAY = 1;
const DEFAULT_HOUR = 12;

interface OldSchedule {
    channelId?: unknown;
    time?: unknown;
    pingRole?: unknown;
}

interface OldGuild {
    _id?: unknown;
    daily?: OldSchedule | null;
    weekly?: OldSchedule | null;
}

const file = process.argv[2];
if (!file) {
    console.error('Usage: npm run import-mongo -- <guilds.json> > import.sql');
    process.exit(1);
}

const now = Date.now();
const statements: string[] = [];
const skipped: string[] = [];
let guildCount = 0;

for (const guild of readDocuments(readFileSync(file, 'utf8'))) {
    guildCount++;
    const guildId = unwrap(guild._id);
    if (!isSnowflake(guildId)) {
        skipped.push(`document with _id ${JSON.stringify(guild._id)}: not a server ID`);
        continue;
    }

    for (const kind of ['daily', 'weekly'] as const) {
        const schedule = guild[kind];
        const channelId = unwrap(schedule?.channelId);
        if (channelId === null || channelId === undefined) continue; // not subscribed
        if (!isSnowflake(channelId)) {
            skipped.push(`${guildId} ${kind}: invalid channel ${JSON.stringify(channelId)}`);
            continue;
        }

        const rawHour = unwrap(schedule?.time) ?? DEFAULT_HOUR;
        const hour = Number(rawHour);
        if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
            skipped.push(`${guildId} ${kind}: invalid time ${JSON.stringify(rawHour)}`);
            continue;
        }

        const pingRole = unwrap(schedule?.pingRole);
        const roleId = isSnowflake(pingRole) ? pingRole : null;
        if (pingRole && !roleId) skipped.push(`${guildId} ${kind}: dropped invalid role ${JSON.stringify(pingRole)}`);

        const weekday = kind === 'weekly' ? MONDAY : null;
        const next = Math.floor(nextSendAt({ timezone: TIMEZONE, hour, weekday }, now) / 1000);

        statements.push(
            'INSERT OR REPLACE INTO subscriptions (guild_id, kind, channel_id, role_id, timezone, hour, weekday, next_send_at) VALUES ' +
                `(${sql(guildId)}, ${sql(kind)}, ${sql(channelId)}, ${sql(roleId)}, ${sql(TIMEZONE)}, ${hour}, ${weekday ?? 'NULL'}, ${next});`,
        );
    }
}

console.log(statements.join('\n'));

const daily = statements.filter((s) => s.includes("'daily'")).length;
console.error(`Read ${guildCount} guilds: ${daily} daily and ${statements.length - daily} weekly schedules.`);
if (skipped.length > 0) console.error(`Skipped ${skipped.length}:\n  ${skipped.join('\n  ')}`);

/** Documents from a JSON array or newline-delimited JSON. */
function readDocuments(text: string): OldGuild[] {
    const trimmed = text.trim();
    if (trimmed.startsWith('[')) return JSON.parse(trimmed);
    return trimmed
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
}

/** Unwraps canonical Extended JSON values like {"$numberInt": "12"}. */
function unwrap(value: unknown): unknown {
    if (value && typeof value === 'object') {
        const wrapped = value as Record<string, unknown>;
        for (const key of ['$numberInt', '$numberLong', '$numberDouble']) {
            if (key in wrapped) return Number(wrapped[key]);
        }
        if ('$oid' in wrapped) return wrapped.$oid;
    }
    return value;
}

function isSnowflake(value: unknown): value is string {
    return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

function sql(value: string | null): string {
    return value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`;
}
