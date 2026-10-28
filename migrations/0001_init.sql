CREATE TABLE subscriptions (
    guild_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('daily', 'weekly')),
    channel_id TEXT NOT NULL,
    role_id TEXT,
    timezone TEXT NOT NULL,
    hour INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
    weekday INTEGER CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday, weekly only
    next_send_at INTEGER NOT NULL,                  -- unix seconds (UTC)
    PRIMARY KEY (guild_id, kind),
    CHECK ((kind = 'weekly') = (weekday IS NOT NULL))
);

CREATE INDEX subscriptions_due ON subscriptions (next_send_at);

CREATE TABLE wiki_days (
    date TEXT PRIMARY KEY,        -- 'MM-DD'
    events TEXT NOT NULL,         -- JSON: [{ "year": number, "text": string, "url": string }]
    fetched_at INTEGER NOT NULL   -- unix seconds
);
