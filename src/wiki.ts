import { format, isExists } from 'date-fns';
import { LEAP_YEAR, USER_AGENT, WIKI_CACHE_SECONDS } from './config';

export interface HistoricalEvent {
    year: number;
    text: string;
    url: string;
}

interface OnThisDayResponse {
    events: {
        year: number;
        text: string;
        pages?: { content_urls?: { desktop?: { page?: string } } }[];
    }[];
}

export function dateArticleUrl(month: number, day: number): string {
    return `https://en.wikipedia.org/wiki/${format(new Date(LEAP_YEAR, month - 1, day), 'MMMM')}_${day}`;
}

/** Wikimedia uses negative years for BC: -44 -> '44 BC' */
export function formatYear(year: number): string {
    return year < 0 ? `${-year} BC` : `${year}`;
}

/**
 * Weekday a historical date fell on. Only given for Gregorian-calendar years,
 * since JS dates can't tell us the weekday of a Julian-calendar date.
 */
export function historicalWeekday(year: number, month: number, day: number): string | null {
    // isExists also rules out Feb 29th in non-leap years
    if (year < 1583 || !isExists(year, month - 1, day)) return null;
    return format(new Date(year, month - 1, day), 'EEEE');
}

/**
 * Events from the "Events" section of Wikipedia's article for a date, oldest first.
 * Served from D1 and refreshed from Wikimedia once the cached copy is a week old.
 */
export async function getEvents(
    db: D1Database,
    month: number,
    day: number,
    now = Date.now(),
): Promise<HistoricalEvent[]> {
    const key = cacheKey(month, day);
    const nowSeconds = Math.floor(now / 1000);
    const cached = await db
        .prepare('SELECT events, fetched_at FROM wiki_days WHERE date = ?')
        .bind(key)
        .first<{ events: string; fetched_at: number }>();

    if (cached && nowSeconds - cached.fetched_at < WIKI_CACHE_SECONDS) {
        return JSON.parse(cached.events);
    }

    let events: HistoricalEvent[];
    try {
        events = await fetchEvents(month, day);
    } catch (err) {
        // A stale copy is better than no events at all
        if (cached) return JSON.parse(cached.events);
        throw err;
    }

    await db
        .prepare('INSERT OR REPLACE INTO wiki_days (date, events, fetched_at) VALUES (?, ?, ?)')
        .bind(key, JSON.stringify(events), nowSeconds)
        .run();

    return events;
}

/**
 * Makes sure the cache has a fresh copy of each date, so the queue consumer
 * rarely has to wait on Wikimedia. Uses one query to find what's missing.
 */
export async function warmEvents(
    db: D1Database,
    dates: { month: number; day: number }[],
    now = Date.now(),
): Promise<void> {
    const byKey = new Map(dates.map((d) => [cacheKey(d.month, d.day), d]));
    const { results } = await db
        .prepare('SELECT date FROM wiki_days WHERE date IN (SELECT value FROM json_each(?)) AND fetched_at > ?')
        .bind(JSON.stringify([...byKey.keys()]), Math.floor(now / 1000) - WIKI_CACHE_SECONDS)
        .all<{ date: string }>();
    for (const { date } of results) byKey.delete(date);

    for (const { month, day } of byKey.values()) {
        try {
            await getEvents(db, month, day, now);
        } catch (err) {
            // The consumer will try again when it needs this date
            console.error(`Failed to warm ${month}/${day}`, err);
        }
    }
}

function cacheKey(month: number, day: number): string {
    return format(new Date(LEAP_YEAR, month - 1, day), 'MM-dd');
}

async function fetchEvents(month: number, day: number): Promise<HistoricalEvent[]> {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const response = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${mm}/${dd}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Wikimedia returned ${response.status} for ${mm}/${dd}`);

    const data = await response.json<OnThisDayResponse>();
    const fallbackUrl = dateArticleUrl(month, day);

    return data.events
        .map((event) => ({
            year: event.year,
            text: event.text,
            url: event.pages?.[0]?.content_urls?.desktop?.page ?? fallbackUrl,
        }))
        .toSorted((a, b) => a.year - b.year);
}

export function filterByYear(events: HistoricalEvent[], min: number | null, max: number | null): HistoricalEvent[] {
    return events.filter((e) => (min === null || e.year >= min) && (max === null || e.year <= max));
}

export function pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}
