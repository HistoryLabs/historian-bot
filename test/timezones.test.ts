import { describe, expect, it } from 'vitest';
import { canonicalTimezone, formatOffset, nextSendAt, searchTimezones } from '../src/timezones';

const at = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();

describe('nextSendAt', () => {
    const chicagoNoon = { timezone: 'America/Chicago', hour: 12, weekday: null };

    it('sends later today if the time has not passed', () => {
        expect(iso(nextSendAt(chicagoNoon, at('2026-10-24T10:00:00Z')))).toBe('2026-10-24T17:00:00.000Z');
    });

    it('sends tomorrow if the time has passed', () => {
        expect(iso(nextSendAt(chicagoNoon, at('2026-10-24T18:00:00Z')))).toBe('2026-10-25T17:00:00.000Z');
    });

    it('is strictly after the given time', () => {
        expect(iso(nextSendAt(chicagoNoon, at('2026-10-24T17:00:00Z')))).toBe('2026-10-25T17:00:00.000Z');
    });

    it('follows the clock across the fall DST change', () => {
        // Nov 1st 2026: Chicago moves from CDT (UTC-5) to CST (UTC-6)
        expect(iso(nextSendAt(chicagoNoon, at('2026-11-01T12:00:00Z')))).toBe('2026-11-01T18:00:00.000Z');
    });

    it('uses the first occurrence of a repeated hour', () => {
        // 1 AM happens at 06:00Z (CDT) and again at 07:00Z (CST)
        const oneAm = { timezone: 'America/Chicago', hour: 1, weekday: null };
        expect(iso(nextSendAt(oneAm, at('2026-11-01T00:00:00Z')))).toBe('2026-11-01T06:00:00.000Z');
    });

    it('moves a skipped hour to just after the gap', () => {
        // Mar 14th 2027: 2:00-3:00 AM doesn't exist in Chicago
        const twoAm = { timezone: 'America/Chicago', hour: 2, weekday: null };
        expect(iso(nextSendAt(twoAm, at('2027-03-14T00:00:00Z')))).toBe('2027-03-14T08:00:00.000Z');
    });

    it('handles half-hour offsets', () => {
        const kolkata = { timezone: 'Asia/Kolkata', hour: 9, weekday: null };
        expect(iso(nextSendAt(kolkata, at('2026-10-24T00:00:00Z')))).toBe('2026-10-24T03:30:00.000Z');
    });

    it('works ahead of UTC', () => {
        // 23:00 UTC on the 24th is 8 AM on the 25th in Tokyo
        const tokyo = { timezone: 'Asia/Tokyo', hour: 9, weekday: null };
        expect(iso(nextSendAt(tokyo, at('2026-10-24T23:00:00Z')))).toBe('2026-10-25T00:00:00.000Z');
    });

    it('finds the next matching weekday', () => {
        const monday = { timezone: 'America/Chicago', hour: 12, weekday: 1 };
        // Saturday Oct 24th -> Monday Oct 26th
        expect(iso(nextSendAt(monday, at('2026-10-24T10:00:00Z')))).toBe('2026-10-26T17:00:00.000Z');
        // Monday after noon -> the following Monday
        expect(iso(nextSendAt(monday, at('2026-10-26T18:00:00Z')))).toBe('2026-11-02T18:00:00.000Z');
    });
});

describe('time zone helpers', () => {
    it('canonicalizes and rejects time zones', () => {
        expect(canonicalTimezone('america/new_york')).toBe('America/New_York');
        expect(canonicalTimezone('UTC')).toBe('UTC');
        expect(canonicalTimezone('Mars/Olympus_Mons')).toBeNull();
    });

    it('formats offsets', () => {
        expect(formatOffset('Asia/Kolkata', at('2026-10-24T00:00:00Z'))).toBe('UTC+05:30');
        expect(formatOffset('America/Chicago', at('2026-12-01T00:00:00Z'))).toBe('UTC-06:00');
    });

    it('searches by city first', () => {
        const results = searchTimezones('london', undefined, Date.now());
        expect(results[0].value).toBe('Europe/London');
        expect(results[0].name).toMatch(/^Europe\/London \(UTC[+-]\d\d:\d\d\)$/);
    });

    it('matches spaces against underscores', () => {
        expect(searchTimezones('new york', undefined, Date.now())[0].value).toBe('America/New_York');
    });

    it('suggests zones for the user locale before they type', () => {
        expect(searchTimezones('', 'en-GB', Date.now())[0].value).toBe('Europe/London');
        expect(searchTimezones('', 'en-US', Date.now()).map(r => r.value)).toContain('America/Los_Angeles');
    });

    it('never returns more than 25 choices', () => {
        expect(searchTimezones('a', undefined, Date.now()).length).toBe(25);
    });
});
