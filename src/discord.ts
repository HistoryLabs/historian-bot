import {
    InteractionResponseType,
    MessageFlags,
    type APIEmbed,
    type APIInteraction,
    type APIInteractionResponse,
    type APIInteractionResponseCallbackData,
    type RESTPatchAPIWebhookWithTokenMessageJSONBody,
} from 'discord-api-types/v10';
import { COLORS, FOOTER } from './config';
import type { Env } from './env';

export const API_BASE = 'https://discord.com/api/v10';

export interface Context<I extends APIInteraction = APIInteraction> {
    interaction: I;
    env: Env;
    waitUntil: (promise: Promise<unknown>) => void;
    now: number;
}

export type MessageBody = RESTPatchAPIWebhookWithTokenMessageJSONBody;

export function embed(data: APIEmbed): APIEmbed {
    return { color: COLORS.default, footer: FOOTER, ...data };
}

export function errorEmbed(message: string): APIEmbed {
    return { color: COLORS.error, description: message };
}

export function reply(body: APIInteractionResponseCallbackData, ephemeral = false): APIInteractionResponse {
    return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { ...body, flags: ephemeral ? MessageFlags.Ephemeral : undefined },
    };
}

export function errorReply(message: string): APIInteractionResponse {
    return reply({ embeds: [errorEmbed(message)] }, true);
}

export function userId(interaction: APIInteraction): string | undefined {
    return interaction.member?.user.id ?? interaction.user?.id;
}

/** Calls the Discord API as the bot. Throws a DiscordError for non-2xx responses. */
export async function discordRequest(env: Env, method: string, path: string, body?: unknown, auth = true): Promise<Response> {
    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            ...(auth ? { Authorization: `Bot ${env.DISCORD_TOKEN}` } : {}),
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new DiscordError(response.status, await response.text());
    return response;
}

/** An error whose message is safe to show to the user. */
export class UserError extends Error {}

export class DiscordError extends Error {
    constructor(public status: number, public body: string) {
        super(`Discord API returned ${status}: ${body}`);
    }
}

/**
 * Acknowledges the interaction now and finishes `work` in the background,
 * editing the original message with its result. Used when the reply may take
 * longer than Discord's 3 second limit (e.g. fetching from Wikipedia).
 *
 * `update` acknowledges a button click by editing the message it's on.
 */
export function deferred(ctx: Context, work: () => Promise<MessageBody>, options: { update?: boolean, ephemeral?: boolean } = {}): APIInteractionResponse {
    const { interaction, env } = ctx;
    const webhook = `/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;

    ctx.waitUntil((async () => {
        let body: MessageBody;
        try {
            body = await work();
        } catch (err) {
            if (!(err instanceof UserError)) console.error(err);
            const message = errorEmbed(err instanceof UserError
                ? err.message
                : 'Something went wrong while finding events. Please try again in a moment.');
            if (options.update) {
                // Keep the existing message and tell only the user who clicked
                await discordRequest(env, 'POST', webhook, { embeds: [message], flags: MessageFlags.Ephemeral }, false);
                return;
            }
            body = { embeds: [message], components: [] };
        }
        await discordRequest(env, 'PATCH', `${webhook}/messages/@original`, body, false);
    })().catch(err => console.error('Failed to send deferred response', err)));

    if (options.update) return { type: InteractionResponseType.DeferredMessageUpdate };
    return {
        type: InteractionResponseType.DeferredChannelMessageWithSource,
        data: options.ephemeral ? { flags: MessageFlags.Ephemeral } : undefined,
    };
}
