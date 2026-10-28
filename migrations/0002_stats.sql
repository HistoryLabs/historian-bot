-- Bot-wide counts, refreshed once a day. Always a single row.
CREATE TABLE stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    guild_count INTEGER NOT NULL,
    member_count INTEGER NOT NULL,
    updated_at INTEGER NOT NULL -- unix seconds
);
