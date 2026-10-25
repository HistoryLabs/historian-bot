import {
    ButtonStyle,
    ComponentType,
    type APIChatInputApplicationCommandInteraction,
    type APIInteractionResponse,
    type APIMessageComponentInteraction,
} from 'discord-api-types/v10';
import { format, getDaysInMonth, isValid, parse } from 'date-fns';
import { DEFAULT_TIMEZONE, EMOJIS, EVENTS_PER_PAGE, FOOTER, LEAP_YEAR } from '../config';
import { getGuildTimezone } from '../db';
import { type Context, type MessageBody, UserError, deferred, embed, errorReply, userId } from '../discord';
import { getInteger, parseOptions } from '../options';
import { zonedDate } from '../timezones';
import { dateArticleUrl, filterByYear, formatYear, getEvents, historicalWeekday, pickRandom } from '../wiki';

// /event [min] [max]

export async function eventCommand(ctx: Context<APIChatInputApplicationCommandInteraction>): Promise<APIInteractionResponse> {
    const options = parseOptions(ctx.interaction.data.options);
    const min = getInteger(options, 'min');
    const max = getInteger(options, 'max');
    if (min !== null && max !== null && min > max) {
        return errorReply('`min` has to be less than or equal to `max`.');
    }

    const owner = userId(ctx.interaction) ?? '';
    return deferred(ctx, async () => {
        // "Today" is in the server's schedule time zone if it has one
        const guildId = ctx.interaction.guild_id;
        const timezone = (guildId && await getGuildTimezone(ctx.env.DB, guildId)) || DEFAULT_TIMEZONE;
        const today = zonedDate(timezone, ctx.now);
        return randomEventMessage(ctx, new Date(LEAP_YEAR, today.getMonth(), today.getDate()), min, max, owner);
    });
}

export function newEventButton(ctx: Context<APIMessageComponentInteraction>, args: string[]): APIInteractionResponse {
    const [key, minArg, maxArg, owner] = args;
    const date = parse(key, 'MM-dd', new Date(LEAP_YEAR, 0, 1));
    if (!isValid(date)) return errorReply('This button is no longer valid. Run `/event` again.');

    if (userId(ctx.interaction) !== owner) {
        return errorReply('Only the person who ran `/event` can get a new event. Run `/event` yourself to get your own!');
    }

    const min = minArg ? Number(minArg) : null;
    const max = maxArg ? Number(maxArg) : null;
    return deferred(ctx, () => randomEventMessage(ctx, date, min, max, owner), { update: true });
}

// `date` is a calendar day in LEAP_YEAR
async function randomEventMessage(ctx: Context, date: Date, min: number | null, max: number | null, owner: string): Promise<MessageBody> {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const events = filterByYear(await getEvents(ctx.env.DB, month, day, ctx.now), min, max);
    if (events.length === 0) {
        throw new UserError('We couldn\'t find any events for today in those years. Try widening `min` and `max`.');
    }

    const event = pickRandom(events);
    const weekday = historicalWeekday(event.year, month, day);

    return {
        embeds: [embed({
            title: `${weekday ? `${weekday}, ` : ''}${format(date, 'MMMM do')}, ${formatYear(event.year)}`,
            url: event.url,
            description: event.text,
            footer: { ...FOOTER, text: `${FOOTER.text} • Randomly selected from ${events.length} events` },
        })],
        components: [{
            type: ComponentType.ActionRow,
            components: [{
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                custom_id: `event:${format(date, 'MM-dd')}:${min ?? ''}:${max ?? ''}:${owner}`,
                label: 'New Event',
                emoji: EMOJIS.refresh,
            }],
        }],
    };
}

// /events <month> <day>

export async function eventsCommand(ctx: Context<APIChatInputApplicationCommandInteraction>): Promise<APIInteractionResponse> {
    const options = parseOptions(ctx.interaction.data.options);
    const month = getInteger(options, 'month') ?? 0;
    const day = getInteger(options, 'day') ?? 0;
    if (month < 1 || month > 12 || day < 1 || day > getDaysInMonth(new Date(LEAP_YEAR, month - 1))) {
        return errorReply('That date doesn\'t exist. Check the month and day and try again.');
    }

    return deferred(ctx, () => eventsPageMessage(ctx, new Date(LEAP_YEAR, month - 1, day), 0));
}

export function eventsPageButton(ctx: Context<APIMessageComponentInteraction>, args: string[]): APIInteractionResponse {
    const [key, pageArg] = args;
    const date = parse(key, 'MM-dd', new Date(LEAP_YEAR, 0, 1));
    if (!isValid(date)) return errorReply('This button is no longer valid. Run `/events` again.');

    return deferred(ctx, () => eventsPageMessage(ctx, date, Number(pageArg) || 0), { update: true });
}

// `date` is a calendar day in LEAP_YEAR
async function eventsPageMessage(ctx: Context, date: Date, page: number): Promise<MessageBody> {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const events = await getEvents(ctx.env.DB, month, day, ctx.now);
    if (events.length === 0) throw new UserError('We couldn\'t find any events for that date.');

    const pageCount = Math.ceil(events.length / EVENTS_PER_PAGE);
    page = Math.min(Math.max(page, 0), pageCount - 1);
    const pageEvents = events.slice(page * EVENTS_PER_PAGE, (page + 1) * EVENTS_PER_PAGE);
    const key = format(date, 'MM-dd');

    return {
        embeds: [embed({
            title: format(date, 'MMMM do'),
            url: dateArticleUrl(month, day),
            fields: pageEvents.map(event => {
                const link = `[Read more](${event.url})`;
                return { name: formatYear(event.year), value: `${truncate(event.text, 1024 - link.length - 1)} ${link}` };
            }),
            footer: { ...FOOTER, text: `${FOOTER.text} • Page ${page + 1} of ${pageCount}` },
        })],
        components: [{
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    custom_id: `events:${key}:${page - 1}`,
                    emoji: EMOJIS.arrowLeft,
                    disabled: page === 0,
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    custom_id: `events:${key}:${page + 1}`,
                    emoji: EMOJIS.arrowRight,
                    disabled: page === pageCount - 1,
                },
            ],
        }],
    };
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
