import { TZDate, tzOffset } from '@date-fns/tz';
import { addDays } from 'date-fns';

/** The given instant (ms) as a date whose getters read the wall clock in `timezone`. */
export function zonedDate(timezone: string, instant: number): TZDate {
    return new TZDate(instant, timezone);
}

/**
 * Next instant (ms) strictly after `after` when a schedule should fire.
 * `weekday` is null for daily schedules. An hour skipped by DST moves to just
 * after the gap; an hour that happens twice uses the first one (in the Workers
 * runtime, which runs in UTC).
 */
export function nextSendAt(
    schedule: { timezone: string; hour: number; weekday: number | null },
    after: number,
): number {
    const today = zonedDate(schedule.timezone, after);
    for (let offset = 0; offset <= 7; offset++) {
        const day = addDays(today, offset);
        if (schedule.weekday !== null && day.getDay() !== schedule.weekday) continue;
        const at = new TZDate(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            schedule.hour,
            schedule.timezone,
        ).getTime();
        if (at > after) return at;
    }
    throw new Error(`No send time found for ${JSON.stringify(schedule)}`);
}

/** Canonical IANA name for a time zone, or null if it isn't one. */
export function canonicalTimezone(input: string): string | null {
    try {
        return new Intl.DateTimeFormat('en-US', { timeZone: input.trim() }).resolvedOptions().timeZone;
    } catch {
        return null;
    }
}

/** 'UTC-05:00' */
export function formatOffset(timezone: string, instant: number): string {
    const minutes = tzOffset(timezone, new Date(instant));
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

let allZones: string[] | null = null;

function timezones(): string[] {
    if (!allZones) {
        allZones = Intl.supportedValuesOf('timeZone');
        if (!allZones.includes('UTC')) allZones.push('UTC');
    }
    return allZones;
}

// Suggestions shown before the user types anything, keyed by Discord locale
const LOCALE_ZONES: Record<string, string[]> = {
    'en-US': [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu',
    ],
    'en-GB': ['Europe/London'],
    de: ['Europe/Berlin'],
    fr: ['Europe/Paris'],
    'es-ES': ['Europe/Madrid'],
    'es-419': ['America/Mexico_City', 'America/Bogota', 'America/Argentina/Buenos_Aires'],
    'pt-BR': ['America/Sao_Paulo'],
    it: ['Europe/Rome'],
    nl: ['Europe/Amsterdam'],
    pl: ['Europe/Warsaw'],
    'sv-SE': ['Europe/Stockholm'],
    ru: ['Europe/Moscow'],
    uk: ['Europe/Kyiv'],
    tr: ['Europe/Istanbul'],
    ja: ['Asia/Tokyo'],
    ko: ['Asia/Seoul'],
    'zh-CN': ['Asia/Shanghai'],
    'zh-TW': ['Asia/Taipei'],
    hi: ['Asia/Kolkata'],
    id: ['Asia/Jakarta'],
    vi: ['Asia/Ho_Chi_Minh'],
    th: ['Asia/Bangkok'],
};

const COMMON_ZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Kolkata',
    'Asia/Tokyo',
    'Australia/Sydney',
];

/** Autocomplete choices for a time zone option (Discord allows at most 25). */
export function searchTimezones(
    query: string,
    locale: string | undefined,
    now: number,
): { name: string; value: string }[] {
    const q = query.trim().toLowerCase().replace(/\s+/g, '_');
    let matches: string[];

    if (!q) {
        matches = [...new Set([...(locale ? (LOCALE_ZONES[locale] ?? []) : []), ...COMMON_ZONES])];
    } else {
        const scored: [number, string][] = [];
        for (const zone of timezones()) {
            const lower = zone.toLowerCase();
            const city = lower.slice(lower.lastIndexOf('/') + 1);
            if (city.startsWith(q)) scored.push([0, zone]);
            else if (lower.startsWith(q)) scored.push([1, zone]);
            else if (lower.includes(q)) scored.push([2, zone]);
        }
        scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
        matches = scored.map(([, zone]) => zone);
    }

    return matches.slice(0, 25).map((zone) => ({
        name: `${zone.replaceAll('_', ' ')} (${formatOffset(zone, now)})`,
        value: zone,
    }));
}
