export const COLORS = {
    default: 0x0ed487,
    error: 0xd40e0e,
};

export const FOOTER = {
    text: 'Historian Bot',
    icon_url: 'https://cdn.discordapp.com/attachments/747968834031321148/821397637601034250/logo.png',
};

export const EMOJIS = {
    arrowLeft: { id: '934588322251149312', name: 'arrowleft' },
    arrowRight: { id: '934588321877864520', name: 'arrowright' },
    refresh: { id: '995882147661492294', name: 'refresh' },
};

export const SUPPORT_INVITE = 'https://discord.gg/Pj68BQf';
export const PATREON_URL = 'https://www.patreon.com/historicaleventsbot';

export const DEFAULT_TIMEZONE = 'America/Chicago';
export const DEFAULT_HOUR = 12;
export const DEFAULT_WEEKDAY = 1; // Monday

// Wikimedia asks API clients to identify themselves with a contact URL.
export const USER_AGENT = 'HistorianBot/5.0 (https://github.com/HistoryLabs/historian-bot)';

// How long a cached Wikipedia date is used before it is refreshed.
export const WIKI_CACHE_SECONDS = 7 * 24 * 60 * 60;

export const EVENTS_PER_PAGE = 5;

// Must match the daily cron in wrangler.jsonc; every other cron run sends scheduled posts
export const STATS_CRON = '0 6 * * *';

/** The bot's About Me text, refreshed daily with the server count (Discord allows 400 characters). */
export const aboutMe = (servers: string) =>
    `A free history bot that shares historical events from Wikipedia, on demand or on a daily or weekly schedule. Serving ${servers} servers. Try /help!`;

// Year used for calendar dates (month + day) so February 29th is valid
export const LEAP_YEAR = 2024;
