import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterByYear, formatYear, getEvents, historicalWeekday } from '../src/wiki';
import { mockFetch } from './helpers';

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => vi.restoreAllMocks());

describe('getEvents', () => {
    it('fetches, trims, sorts and caches a date', async () => {
        const calls = mockFetch({ wikimediaYears: [1945, -44, 2001] });
        const now = Date.parse('2026-10-24T12:00:00Z');

        const events = await getEvents(env.DB, 3, 15, now);
        expect(events.map(e => e.year)).toEqual([-44, 1945, 2001]);
        expect(events[0]).toEqual({ year: -44, text: 'Something happened in -44.', url: 'https://en.wikipedia.org/wiki/Event_-44' });
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/03/15');
        expect(calls[0].headers.get('User-Agent')).toContain('HistorianBot');

        // Second read comes from D1
        expect(await getEvents(env.DB, 3, 15, now + DAY)).toEqual(events);
        expect(calls).toHaveLength(1);
    });

    it('refreshes after a week', async () => {
        const calls = mockFetch({ wikimediaYears: [1900] });
        const now = Date.parse('2026-10-24T12:00:00Z');
        await getEvents(env.DB, 4, 1, now);
        await getEvents(env.DB, 4, 1, now + 8 * DAY);
        expect(calls).toHaveLength(2);
    });

    it('falls back to a stale copy if Wikimedia is down', async () => {
        const now = Date.parse('2026-10-24T12:00:00Z');
        mockFetch({ wikimediaYears: [1800] });
        await getEvents(env.DB, 5, 1, now);

        vi.restoreAllMocks();
        mockFetch({ wikimediaStatus: 503 });
        expect((await getEvents(env.DB, 5, 1, now + 8 * DAY)).map(e => e.year)).toEqual([1800]);
    });

    it('throws if Wikimedia is down and nothing is cached', async () => {
        mockFetch({ wikimediaStatus: 503 });
        await expect(getEvents(env.DB, 6, 1)).rejects.toThrow('503');
    });
});

describe('filterByYear', () => {
    const events = [-44, 1000, 1945].map(year => ({ year, text: '', url: '' }));

    it('filters inclusively and treats null as unbounded', () => {
        expect(filterByYear(events, 1000, null).map(e => e.year)).toEqual([1000, 1945]);
        expect(filterByYear(events, null, 1000).map(e => e.year)).toEqual([-44, 1000]);
        expect(filterByYear(events, null, null)).toHaveLength(3);
    });
});

describe('formatting', () => {
    it('formats BC years', () => {
        expect(formatYear(-44)).toBe('44 BC');
        expect(formatYear(1945)).toBe('1945');
    });

    it('gives weekdays for Gregorian dates only', () => {
        expect(historicalWeekday(1945, 10, 24)).toBe('Wednesday');
        expect(historicalWeekday(1000, 10, 24)).toBeNull();
        expect(historicalWeekday(1900, 2, 29)).toBeNull();
    });
});
