import type { PostMessage } from './posts';

export interface Env {
    DB: D1Database;
    POSTS: Queue<PostMessage>;
    DISCORD_APPLICATION_ID: string;
    DISCORD_PUBLIC_KEY: string;
    DISCORD_TOKEN: string;
    TOPGG_TOKEN?: string;
}
