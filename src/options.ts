import { ApplicationCommandOptionType, type APIApplicationCommandInteractionDataOption } from 'discord-api-types/v10';

export interface ParsedOptions {
    subcommand: string | null;
    values: Record<string, string | number | boolean>;
    focused: string | null; // option being autocompleted
}

/** Flattens slash command options (including one level of subcommand) into a name -> value map. */
export function parseOptions(options: APIApplicationCommandInteractionDataOption[] = []): ParsedOptions {
    const parsed: ParsedOptions = { subcommand: null, values: {}, focused: null };
    let list = options;

    const sub = options.find(o => o.type === ApplicationCommandOptionType.Subcommand);
    if (sub && sub.type === ApplicationCommandOptionType.Subcommand) {
        parsed.subcommand = sub.name;
        list = sub.options ?? [];
    }

    for (const option of list) {
        if ('value' in option) {
            parsed.values[option.name] = option.value;
            if ('focused' in option && option.focused) parsed.focused = option.name;
        }
    }
    return parsed;
}

export function getInteger(parsed: ParsedOptions, name: string): number | null {
    const value = parsed.values[name];
    return typeof value === 'number' ? value : null;
}

export function getString(parsed: ParsedOptions, name: string): string | null {
    const value = parsed.values[name];
    return typeof value === 'string' ? value : null;
}
