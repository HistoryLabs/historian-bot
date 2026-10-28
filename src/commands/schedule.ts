import {
    ChannelType,
    InteractionResponseType,
    PermissionFlagsBits,
    type APIApplicationCommandAutocompleteInteraction,
    type APIChatInputApplicationCommandInteraction,
    type APIInteractionResponse,
} from 'discord-api-types/v10';
import { format, setDay } from 'date-fns';
import { DEFAULT_HOUR, DEFAULT_TIMEZONE, DEFAULT_WEEKDAY } from '../config';
import { type ScheduleKind, type Subscription, deleteSubscription, getSubscriptions, upsertSubscription } from '../db';
import { type Context, DiscordError, discordRequest, embed, errorReply, reply } from '../discord';
import { type ParsedOptions, getInteger, getString, parseOptions } from '../options';
import { canonicalTimezone, nextSendAt, searchTimezones } from '../timezones';

type CommandContext = Context<APIChatInputApplicationCommandInteraction>;

// What the bot needs in a channel to post there
const POST_PERMISSIONS =
    PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks;

export async function scheduleCommand(ctx: CommandContext): Promise<APIInteractionResponse> {
    const { interaction } = ctx;
    if (!interaction.guild_id || !interaction.member) {
        return errorReply('Schedules can only be set up in a server.');
    }

    // Discord hides the command from members without Manage Server, but server
    // admins can override that in Integrations settings, so check here too.
    const permissions = BigInt(interaction.member.permissions);
    if ((permissions & (PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator)) === 0n) {
        return errorReply("You need the **Manage Server** permission to change this server's schedules.");
    }

    const options = parseOptions(interaction.data.options);
    switch (options.subcommand) {
        case 'daily':
        case 'weekly':
            return setSchedule(ctx, interaction.guild_id, options.subcommand, options);
        case 'view':
            return viewSchedules(ctx, interaction.guild_id);
        case 'stop':
            return stopSchedule(ctx, interaction.guild_id, getString(options, 'schedule') as ScheduleKind);
        default:
            return errorReply('Unknown subcommand.');
    }
}

async function setSchedule(
    ctx: CommandContext,
    guildId: string,
    kind: ScheduleKind,
    options: ParsedOptions,
): Promise<APIInteractionResponse> {
    const { interaction, env } = ctx;
    const channelId = getString(options, 'channel') ?? interaction.channel.id;
    const hour = getInteger(options, 'time') ?? DEFAULT_HOUR;
    const weekday = kind === 'weekly' ? (getInteger(options, 'day') ?? DEFAULT_WEEKDAY) : null;
    const roleId = getString(options, 'role');

    const timezoneInput = getString(options, 'timezone');
    const timezone = timezoneInput ? canonicalTimezone(timezoneInput) : DEFAULT_TIMEZONE;
    if (!timezone) {
        return errorReply(
            `\`${timezoneInput}\` isn't a time zone I recognize. Start typing a city, like "New York" or "London", and pick one from the list.`,
        );
    }

    if (channelId === interaction.channel.id) {
        if (
            interaction.channel.type !== ChannelType.GuildText &&
            interaction.channel.type !== ChannelType.GuildAnnouncement
        ) {
            return errorReply(
                'I can only post in text or announcement channels. Use the `channel` option to pick one.',
            );
        }
        if ((BigInt(interaction.app_permissions) & POST_PERMISSIONS) !== POST_PERMISSIONS) {
            return errorReply(
                'I need the **View Channel**, **Send Messages**, and **Embed Links** permissions in this channel to post here.',
            );
        }
    } else {
        // We can't see the bot's permissions in other channels, so post a notice there to check
        try {
            await discordRequest(env, 'POST', `/channels/${channelId}/messages`, {
                embeds: [embed({ description: `This channel will now receive ${kind} historical events.` })],
            });
        } catch (err) {
            if (err instanceof DiscordError && (err.status === 403 || err.status === 404)) {
                return errorReply(
                    `I can't post in <#${channelId}>. Make sure I have the **View Channel**, **Send Messages**, and **Embed Links** permissions there.`,
                );
            }
            throw err;
        }
    }

    const existing = (await getSubscriptions(env.DB, guildId)).find((s) => s.kind === kind);
    const nextSend = nextSendAt({ timezone, hour, weekday }, ctx.now);
    const subscription: Subscription = {
        guild_id: guildId,
        kind,
        channel_id: channelId,
        role_id: roleId,
        timezone,
        hour,
        weekday,
        next_send_at: Math.floor(nextSend / 1000),
    };
    await upsertSubscription(env.DB, subscription);

    let description = `${describe(subscription)}.\n\nNext post: ${timestamp(subscription.next_send_at)}`;
    if (!timezoneInput) {
        description += '\n\nTimes are in US Central time. Use the `timezone` option to change it.';
    }

    return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            embeds: [
                embed({
                    title: `${kind === 'daily' ? 'Daily' : 'Weekly'} events ${existing ? 'updated' : 'set up'}!`,
                    description,
                }),
            ],
            allowed_mentions: { parse: [] },
        },
    };
}

async function viewSchedules(ctx: CommandContext, guildId: string): Promise<APIInteractionResponse> {
    const subscriptions = await getSubscriptions(ctx.env.DB, guildId);
    if (subscriptions.length === 0) {
        return reply(
            {
                embeds: [
                    embed({
                        title: 'Scheduled posts',
                        description:
                            'This server has no scheduled posts. Set one up with `/schedule daily` or `/schedule weekly`.',
                    }),
                ],
            },
            true,
        );
    }

    return reply(
        {
            embeds: [
                embed({
                    title: 'Scheduled posts',
                    fields: subscriptions.map((sub) => ({
                        name: sub.kind === 'daily' ? 'Daily' : 'Weekly',
                        value: `${describe(sub)}\nNext post: ${timestamp(sub.next_send_at)}`,
                    })),
                }),
            ],
            allowed_mentions: { parse: [] },
        },
        true,
    );
}

async function stopSchedule(ctx: CommandContext, guildId: string, kind: ScheduleKind): Promise<APIInteractionResponse> {
    const existing = (await getSubscriptions(ctx.env.DB, guildId)).find((s) => s.kind === kind);
    if (!existing || !(await deleteSubscription(ctx.env.DB, guildId, kind))) {
        return errorReply(`This server doesn't have ${kind} posts set up.`);
    }

    return reply({
        embeds: [embed({ description: `<#${existing.channel_id}> will no longer receive ${kind} events.` })],
    });
}

export function scheduleAutocomplete(
    ctx: Context<APIApplicationCommandAutocompleteInteraction>,
): APIInteractionResponse {
    const options = parseOptions(ctx.interaction.data.options);
    const choices =
        options.focused === 'timezone'
            ? searchTimezones(getString(options, 'timezone') ?? '', ctx.interaction.locale, ctx.now)
            : [];
    return { type: InteractionResponseType.ApplicationCommandAutocompleteResult, data: { choices } };
}

/** '<#channel> every Monday at 12 PM (America/Chicago), pinging <@&role>' */
function describe(sub: Subscription): string {
    const when = sub.weekday === null ? 'every day' : `every ${format(setDay(0, sub.weekday), 'EEEE')}`;
    const what = sub.kind === 'daily' ? 'a historical event' : 'an event for each day of the week';
    const ping = sub.role_id ? `, pinging ${sub.role_id === sub.guild_id ? '@everyone' : `<@&${sub.role_id}>`}` : '';
    return `<#${sub.channel_id}> gets ${what} ${when} at ${format(new Date(0, 0, 1, sub.hour), 'h a')} (${sub.timezone})${ping}`;
}

/** Discord timestamp, shown in each viewer's own time zone */
function timestamp(unixSeconds: number): string {
    return `<t:${unixSeconds}:F> (<t:${unixSeconds}:R>)`;
}
