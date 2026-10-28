// Slash command definitions, registered with scripts/register-commands.ts.
// This file is also run directly by Node, so it may only import from packages.
import {
    ApplicationCommandOptionType,
    ApplicationIntegrationType,
    ChannelType,
    InteractionContextType,
    PermissionFlagsBits,
    type APIApplicationCommandBasicOption,
    type RESTPutAPIApplicationCommandsJSONBody,
} from 'discord-api-types/v10';
import { format, setDay } from 'date-fns';

const hourChoices = Array.from({ length: 24 }, (_, hour) => ({
    name: format(new Date(0, 0, 1, hour), 'h a'),
    value: hour,
}));

const scheduleOptions = (kind: 'daily' | 'weekly'): APIApplicationCommandBasicOption[] => [
    {
        type: ApplicationCommandOptionType.Channel,
        name: 'channel',
        description: 'Channel to post in (defaults to this one)',
        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
    },
    ...(kind === 'weekly'
        ? [
              {
                  type: ApplicationCommandOptionType.Integer as const,
                  name: 'day',
                  description: 'Day of the week to post (defaults to Monday)',
                  choices: Array.from({ length: 7 }, (_, value) => ({ name: format(setDay(0, value), 'EEEE'), value })),
              },
          ]
        : []),
    {
        type: ApplicationCommandOptionType.Integer,
        name: 'time',
        description: 'Time of day to post (defaults to 12 PM)',
        choices: hourChoices,
    },
    {
        type: ApplicationCommandOptionType.String,
        name: 'timezone',
        description: 'Your time zone, e.g. America/New_York (defaults to US Central)',
        autocomplete: true,
    },
    {
        type: ApplicationCommandOptionType.Role,
        name: 'role',
        description: 'A role to ping with each post',
    },
];

const guildOnly = {
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
};

export const commands: RESTPutAPIApplicationCommandsJSONBody = [
    {
        name: 'help',
        description: 'Get a list of commands',
        ...guildOnly,
    },
    {
        name: 'info',
        description: 'Learn more about the bot',
        ...guildOnly,
    },
    {
        name: 'event',
        description: 'Get a random historical event that happened on this day',
        ...guildOnly,
        options: [
            {
                type: ApplicationCommandOptionType.Integer,
                name: 'min',
                description: 'Earliest year to include (use negative numbers for BC)',
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: 'max',
                description: 'Latest year to include (use negative numbers for BC)',
            },
        ],
    },
    {
        name: 'events',
        description: 'List every historical event on a date',
        ...guildOnly,
        options: [
            {
                type: ApplicationCommandOptionType.Integer,
                name: 'month',
                description: 'Month (1-12)',
                min_value: 1,
                max_value: 12,
                required: true,
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: 'day',
                description: 'Day of the month',
                min_value: 1,
                max_value: 31,
                required: true,
            },
        ],
    },
    {
        name: 'schedule',
        description: 'Set up automatic history posts',
        ...guildOnly,
        default_member_permissions: String(PermissionFlagsBits.ManageGuild),
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'daily',
                description: 'Post a historical event every day',
                options: scheduleOptions('daily'),
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'weekly',
                description: 'Post a historical event for each day of the week, once a week',
                options: scheduleOptions('weekly'),
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'view',
                description: "Show this server's scheduled posts",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'stop',
                description: 'Stop scheduled posts',
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: 'schedule',
                        description: 'Which schedule to stop',
                        required: true,
                        choices: [
                            { name: 'Daily', value: 'daily' },
                            { name: 'Weekly', value: 'weekly' },
                        ],
                    },
                ],
            },
        ],
    },
];
