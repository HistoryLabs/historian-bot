import type { APIInteractionResponse } from 'discord-api-types/v10';
import { PATREON_URL, SUPPORT_INVITE } from '../config';
import { embed, reply } from '../discord';

export function help(): APIInteractionResponse {
    const commands = [
        [
            '/event [min] [max]',
            'A random historical event that happened on this day. Use min and max to limit the years.',
        ],
        ['/events <month> <day>', 'Every historical event on a date.'],
        [
            '/schedule daily',
            'Post a historical event every day. Choose the channel, time, time zone, and a role to ping.',
        ],
        ['/schedule weekly', 'Post an event for each day of the week, once a week.'],
        ['/schedule view', "Show this server's scheduled posts and when the next ones will go out."],
        ['/schedule stop', 'Stop daily or weekly posts.'],
        ['/info', 'What the bot is and where its events come from.'],
    ];

    return reply(
        {
            embeds: [
                embed({
                    title: 'Historian Bot Commands',
                    description:
                        commands.map(([name, text]) => `**\`${name}\`**\n${text}`).join('\n\n') +
                        '\n\nThe `/schedule` commands need the **Manage Server** permission.' +
                        `\n\nTo suggest something, report a bug, or get help, join the [Historian Bot Support Server](${SUPPORT_INVITE}).`,
                }),
            ],
        },
        true,
    );
}

export function info(): APIInteractionResponse {
    return reply(
        {
            embeds: [
                embed({
                    title: 'What am I?',
                    description:
                        "I'm a free history bot built for communities to share their love for history by learning and discussing together. " +
                        'All events come from [Wikipedia](https://wikipedia.org/). ' +
                        `If you'd like to support the bot, check out our [Patreon](${PATREON_URL}). All donations go toward its development and upkeep.` +
                        `\n\nTo suggest something, report a bug, or get help, join the [Historian Bot Support Server](${SUPPORT_INVITE}).`,
                }),
            ],
        },
        true,
    );
}
