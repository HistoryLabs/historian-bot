import { env } from 'cloudflare:test';
import {
    ApplicationCommandOptionType as Opt,
    InteractionResponseType,
    InteractionType,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord-api-types/v10';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    APP_ID,
    CHANNEL_ID,
    USER_ID,
    autocomplete,
    button,
    command,
    mockFetch,
    option,
    send,
    subcommand,
} from './helpers';

afterEach(async () => {
    vi.restoreAllMocks();
    // Each test mocks its own Wikipedia data
    await env.DB.exec('DELETE FROM wiki_days');
});

const ORIGINAL = `https://discord.com/api/v10/webhooks/${APP_ID}/interaction-token/messages/@original`;

async function subscription(guildId: string, kind: string) {
    return env.DB.prepare('SELECT * FROM subscriptions WHERE guild_id = ? AND kind = ?')
        .bind(guildId, kind)
        .first<any>();
}

describe('request handling', () => {
    it('rejects bad signatures', async () => {
        const { status } = await send({ type: InteractionType.Ping }, { badSignature: true });
        expect(status).toBe(401);
    });

    it('answers pings', async () => {
        const { status, body } = await send({ type: InteractionType.Ping });
        expect(status).toBe(200);
        expect(body).toEqual({ type: InteractionResponseType.Pong });
    });

    it('replies to /help privately', async () => {
        const { body } = await send(command('help'));
        expect(body.type).toBe(InteractionResponseType.ChannelMessageWithSource);
        expect(body.data.flags).toBe(MessageFlags.Ephemeral);
        expect(body.data.embeds[0].description).toContain('/schedule daily');
    });
});

describe('/events', () => {
    it('defers, then edits in the first page', async () => {
        const calls = mockFetch({ wikimediaYears: [1, 2, 3, 4, 5, 6, 7] });
        const { body } = await send(
            command('events', [option(Opt.Integer, 'month', 10), option(Opt.Integer, 'day', 24)]),
        );
        expect(body.type).toBe(InteractionResponseType.DeferredChannelMessageWithSource);

        const edit = calls.find((c) => c.url === ORIGINAL)!;
        expect(edit.method).toBe('PATCH');
        expect(edit.headers.get('Authorization')).toBeNull();
        const embed = edit.body.embeds[0];
        expect(embed.title).toBe('October 24th');
        expect(embed.fields.map((f: any) => f.name)).toEqual(['1', '2', '3', '4', '5']);
        expect(embed.footer.text).toContain('Page 1 of 2');

        const [back, forward] = edit.body.components[0].components;
        expect(back).toMatchObject({ custom_id: 'events:10-24:-1', disabled: true });
        expect(forward).toMatchObject({ custom_id: 'events:10-24:1', disabled: false });
    });

    it('pages with the buttons', async () => {
        const calls = mockFetch({ wikimediaYears: [1, 2, 3, 4, 5, 6, 7] });
        const { body } = await send(button('events:10-25:1'));
        expect(body.type).toBe(InteractionResponseType.DeferredMessageUpdate);

        const edit = calls.find((c) => c.url === ORIGINAL)!;
        expect(edit.body.embeds[0].fields.map((f: any) => f.name)).toEqual(['6', '7']);
        expect(edit.body.components[0].components[1].disabled).toBe(true);
    });

    it('rejects buttons with an invalid date', async () => {
        const calls = mockFetch();
        const { body } = await send(button('events:02-30:0'));
        expect(body.data.embeds[0].description).toContain('no longer valid');
        expect(calls).toHaveLength(0);
    });

    it('rejects dates that do not exist', async () => {
        const { body } = await send(
            command('events', [option(Opt.Integer, 'month', 2), option(Opt.Integer, 'day', 30)]),
        );
        expect(body.data.flags).toBe(MessageFlags.Ephemeral);
        expect(body.data.embeds[0].description).toContain("doesn't exist");
    });

    it('shows an error if Wikipedia is unavailable', async () => {
        const calls = mockFetch({ wikimediaStatus: 503 });
        await send(command('events', [option(Opt.Integer, 'month', 1), option(Opt.Integer, 'day', 2)]));
        const edit = calls.find((c) => c.url === ORIGINAL)!;
        expect(edit.body.embeds[0].description).toContain('Something went wrong');
        expect(edit.body.components).toEqual([]);
    });
});

describe('/event', () => {
    it('picks an event within the year range and adds a New Event button', async () => {
        const calls = mockFetch({ wikimediaYears: [1500, 1945, 2001] });
        await send(command('event', [option(Opt.Integer, 'min', 1900), option(Opt.Integer, 'max', 1950)]));

        const edit = calls.find((c) => c.url === ORIGINAL)!;
        expect(edit.body.embeds[0].title).toMatch(/, 1945$/);
        expect(edit.body.embeds[0].footer.text).toContain('Randomly selected from 1 events');
        expect(edit.body.components[0].components[0].custom_id).toMatch(
            new RegExp(`^event:\\d\\d-\\d\\d:1900:1950:${USER_ID}$`),
        );
    });

    it('explains when no events match the filters', async () => {
        const calls = mockFetch({ wikimediaYears: [1500] });
        await send(command('event', [option(Opt.Integer, 'min', 1900)]));
        expect(calls.find((c) => c.url === ORIGINAL)!.body.embeds[0].description).toContain('widening');
    });

    it('rejects min greater than max', async () => {
        const { body } = await send(
            command('event', [option(Opt.Integer, 'min', 2000), option(Opt.Integer, 'max', 1000)]),
        );
        expect(body.data.embeds[0].description).toContain('less than or equal');
    });

    it('only lets the original user get a new event', async () => {
        const calls = mockFetch();
        const { body } = await send(button(`event:10-24:::${USER_ID}`, { userId: '999' }));
        expect(body.type).toBe(InteractionResponseType.ChannelMessageWithSource);
        expect(body.data.flags).toBe(MessageFlags.Ephemeral);
        expect(calls).toHaveLength(0);
    });

    it('swaps in a new event for the original user', async () => {
        const calls = mockFetch({ wikimediaYears: [1945] });
        const { body } = await send(button(`event:10-24:::${USER_ID}`));
        expect(body.type).toBe(InteractionResponseType.DeferredMessageUpdate);
        expect(calls.find((c) => c.url === ORIGINAL)!.body.embeds[0].title).toBe('Wednesday, October 24th, 1945');
    });
});

describe('/schedule', () => {
    it('requires Manage Server', async () => {
        const { body } = await send(subcommand('schedule', 'daily', [], { guildId: 'g-perm', permissions: 0n }));
        expect(body.data.embeds[0].description).toContain('Manage Server');
        expect(await subscription('g-perm', 'daily')).toBeNull();
    });

    it('sets up daily posts in the current channel with defaults', async () => {
        const { body } = await send(subcommand('schedule', 'daily', [], { guildId: 'g-daily' }));
        expect(body.data.embeds[0].title).toBe('Daily events set up!');
        expect(body.data.embeds[0].description).toContain('12 PM (America/Chicago)');
        expect(body.data.embeds[0].description).toContain('US Central time');
        expect(body.data.allowed_mentions).toEqual({ parse: [] });

        const row = await subscription('g-daily', 'daily');
        expect(row).toMatchObject({
            channel_id: CHANNEL_ID,
            timezone: 'America/Chicago',
            hour: 12,
            weekday: null,
            role_id: null,
        });
        expect(row.next_send_at).toBeGreaterThan(Date.now() / 1000);
        expect(body.data.embeds[0].description).toContain(`<t:${row.next_send_at}:F>`);
    });

    it('updates an existing schedule', async () => {
        await send(subcommand('schedule', 'daily', [], { guildId: 'g-update' }));
        const { body } = await send(
            subcommand(
                'schedule',
                'daily',
                [
                    option(Opt.Integer, 'time', 9),
                    option(Opt.String, 'timezone', 'europe/london'),
                    option(Opt.Role, 'role', '444'),
                ],
                { guildId: 'g-update' },
            ),
        );

        expect(body.data.embeds[0].title).toBe('Daily events updated!');
        expect(body.data.embeds[0].description).not.toContain('US Central');
        expect(await subscription('g-update', 'daily')).toMatchObject({
            hour: 9,
            timezone: 'Europe/London',
            role_id: '444',
        });
    });

    it('rejects unknown time zones', async () => {
        const { body } = await send(
            subcommand('schedule', 'daily', [option(Opt.String, 'timezone', 'Narnia')], { guildId: 'g-tz' }),
        );
        expect(body.data.embeds[0].description).toContain("isn't a time zone");
        expect(await subscription('g-tz', 'daily')).toBeNull();
    });

    it('defaults weekly posts to Monday', async () => {
        await send(subcommand('schedule', 'weekly', [], { guildId: 'g-weekly' }));
        expect(await subscription('g-weekly', 'weekly')).toMatchObject({ weekday: 1 });
    });

    it('checks the bot can post in the current channel', async () => {
        const { body } = await send(
            subcommand('schedule', 'daily', [], {
                guildId: 'g-noperm',
                appPermissions: String(PermissionFlagsBits.ViewChannel),
            }),
        );
        expect(body.data.embeds[0].description).toContain('Send Messages');
        expect(await subscription('g-noperm', 'daily')).toBeNull();
    });

    it('posts a notice to test another channel', async () => {
        const calls = mockFetch();
        await send(subcommand('schedule', 'daily', [option(Opt.Channel, 'channel', '555')], { guildId: 'g-other' }));

        const notice = calls.find((c) => c.url === 'https://discord.com/api/v10/channels/555/messages')!;
        expect(notice.headers.get('Authorization')).toBe('Bot test-token');
        expect(await subscription('g-other', 'daily')).toMatchObject({ channel_id: '555' });
    });

    it('refuses another channel the bot cannot post in', async () => {
        mockFetch({ discordStatus: () => 403 });
        const { body } = await send(
            subcommand('schedule', 'daily', [option(Opt.Channel, 'channel', '666')], { guildId: 'g-forbidden' }),
        );
        expect(body.data.embeds[0].description).toContain("can't post in <#666>");
        expect(await subscription('g-forbidden', 'daily')).toBeNull();
    });

    it('views and stops schedules', async () => {
        await send(subcommand('schedule', 'daily', [], { guildId: 'g-stop' }));

        const view = await send(subcommand('schedule', 'view', [], { guildId: 'g-stop' }));
        expect(view.body.data.embeds[0].fields).toHaveLength(1);

        const stop = await send(
            subcommand('schedule', 'stop', [option(Opt.String, 'schedule', 'daily')], { guildId: 'g-stop' }),
        );
        expect(stop.body.data.embeds[0].description).toContain(`<#${CHANNEL_ID}> will no longer`);
        expect(await subscription('g-stop', 'daily')).toBeNull();

        const again = await send(
            subcommand('schedule', 'stop', [option(Opt.String, 'schedule', 'daily')], { guildId: 'g-stop' }),
        );
        expect(again.body.data.embeds[0].description).toContain("doesn't have daily posts");
    });

    it('autocompletes time zones', async () => {
        const { body } = await send(
            autocomplete('schedule', [
                {
                    type: Opt.Subcommand,
                    name: 'daily',
                    options: [option(Opt.String, 'timezone', 'tokyo', true)],
                },
            ]),
        );
        expect(body.type).toBe(InteractionResponseType.ApplicationCommandAutocompleteResult);
        expect(body.data.choices[0].value).toBe('Asia/Tokyo');
    });
});
