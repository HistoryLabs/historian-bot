import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChannelType,
    ComponentType,
    InteractionType,
    PermissionFlagsBits,
} from 'discord-api-types/v10';
import { vi } from 'vitest';
import worker from '../src/index';

export const APP_ID = env.DISCORD_APPLICATION_ID;
export const USER_ID = '111111111111111111';
export const CHANNEL_ID = '222222222222222222';

const ALL_POST_PERMISSIONS = String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks);

let signingKey: Promise<CryptoKey> | null = null;

export async function signedRequest(body: unknown, options: { badSignature?: boolean } = {}): Promise<Request> {
    signingKey ??= crypto.subtle.importKey('jwk', env.TEST_PRIVATE_KEY, { name: 'Ed25519' }, false, ['sign']);
    const text = JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = new Uint8Array(await crypto.subtle.sign('Ed25519', await signingKey, new TextEncoder().encode(timestamp + text)));
    if (options.badSignature) signed[0] ^= 0xff;
    const signature = [...signed].map(b => b.toString(16).padStart(2, '0')).join('');

    return new Request('https://bot.test/interactions', {
        method: 'POST',
        headers: { 'X-Signature-Ed25519': signature, 'X-Signature-Timestamp': timestamp },
        body: text,
    });
}

/** Sends an interaction to the Worker and waits for any deferred work to finish. */
export async function send(interaction: unknown, options: { badSignature?: boolean } = {}) {
    const ctx = createExecutionContext();
    const request = await signedRequest(interaction, options) as Request<unknown, IncomingRequestCfProperties>;
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const body = response.status === 200 ? await response.json<any>() : null;
    return { status: response.status, body };
}

interface CommandOptions {
    guildId?: string;
    userId?: string;
    permissions?: bigint;
    appPermissions?: string;
    channelType?: ChannelType;
    locale?: string;
}

function base(type: InteractionType, options: CommandOptions) {
    const guildId = options.guildId ?? '333333333333333333';
    return {
        id: '1',
        application_id: APP_ID,
        type,
        token: 'interaction-token',
        version: 1,
        guild_id: guildId,
        channel_id: CHANNEL_ID,
        channel: { id: CHANNEL_ID, type: options.channelType ?? ChannelType.GuildText },
        app_permissions: options.appPermissions ?? ALL_POST_PERMISSIONS,
        locale: options.locale ?? 'en-US',
        member: {
            user: { id: options.userId ?? USER_ID, username: 'tester' },
            permissions: String(options.permissions ?? PermissionFlagsBits.ManageGuild),
        },
    };
}

export function command(name: string, options: unknown[] = [], extra: CommandOptions = {}) {
    return {
        ...base(InteractionType.ApplicationCommand, extra),
        data: { id: '2', type: ApplicationCommandType.ChatInput, name, options },
    };
}

export function subcommand(name: string, sub: string, options: unknown[] = [], extra: CommandOptions = {}) {
    return command(name, [{ type: ApplicationCommandOptionType.Subcommand, name: sub, options }], extra);
}

export function button(customId: string, extra: CommandOptions = {}) {
    return {
        ...base(InteractionType.MessageComponent, extra),
        message: { id: '3' },
        data: { custom_id: customId, component_type: ComponentType.Button },
    };
}

export function autocomplete(name: string, options: unknown[], extra: CommandOptions = {}) {
    return {
        ...base(InteractionType.ApplicationCommandAutocomplete, extra),
        data: { id: '2', type: ApplicationCommandType.ChatInput, name, options },
    };
}

export function option(type: ApplicationCommandOptionType, name: string, value: unknown, focused?: boolean) {
    return { type, name, value, ...(focused ? { focused } : {}) };
}

/** A Wikimedia "On this day" response with the given years. */
export function wikimediaResponse(years: number[]) {
    return {
        events: years.map(year => ({
            year,
            text: `Something happened in ${year}.`,
            pages: [{ content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/Event_${year}` } } }],
        })),
    };
}

export interface RecordedCall {
    url: string;
    method: string;
    headers: Headers;
    body: any;
}

/**
 * Replaces global fetch. Wikimedia requests get `wikimediaYears` events,
 * Discord requests get `discordStatus`. Returns the recorded calls.
 */
export function mockFetch(options: { wikimediaYears?: number[], wikimediaStatus?: number, discordStatus?: (url: string) => number } = {}) {
    const calls: RecordedCall[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const request = new Request(input, init);
        const text = await request.text();
        calls.push({ url: request.url, method: request.method, headers: request.headers, body: text ? JSON.parse(text) : null });

        if (request.url.startsWith('https://api.wikimedia.org/')) {
            const status = options.wikimediaStatus ?? 200;
            if (status !== 200) return new Response('error', { status });
            return Response.json(wikimediaResponse(options.wikimediaYears ?? [1945, 1260, 2001, 1648, 1901, 1931, 1998]));
        }
        if (request.url.startsWith('https://discord.com/')) {
            const status = options.discordStatus?.(request.url) ?? 200;
            return status === 200 ? Response.json({ id: '9' }) : new Response(JSON.stringify({ message: 'Missing Access' }), { status });
        }
        throw new Error(`Unexpected fetch: ${request.url}`);
    });
    return calls;
}
