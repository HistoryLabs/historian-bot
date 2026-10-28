import {
    ApplicationCommandType,
    InteractionResponseType,
    InteractionType,
    type APIApplicationCommandAutocompleteInteraction,
    type APIChatInputApplicationCommandInteraction,
    type APIInteractionResponse,
    type APIMessageComponentInteraction,
} from 'discord-api-types/v10';
import { eventCommand, eventsCommand, eventsPageButton, newEventButton } from './commands/events';
import { help, info } from './commands/info';
import { scheduleAutocomplete, scheduleCommand } from './commands/schedule';
import { type Context, errorReply } from './discord';

export async function handleInteraction(ctx: Context): Promise<APIInteractionResponse> {
    const { interaction } = ctx;

    try {
        switch (interaction.type) {
            case InteractionType.Ping:
                return { type: InteractionResponseType.Pong };

            case InteractionType.ApplicationCommand: {
                if (interaction.data.type !== ApplicationCommandType.ChatInput) break;
                const command = ctx as Context<APIChatInputApplicationCommandInteraction>;
                switch (interaction.data.name) {
                    case 'help':
                        return help();
                    case 'info':
                        return info();
                    case 'event':
                        return await eventCommand(command);
                    case 'events':
                        return await eventsCommand(command);
                    case 'schedule':
                        return await scheduleCommand(command);
                }
                break;
            }

            case InteractionType.MessageComponent: {
                const [prefix, ...args] = interaction.data.custom_id.split(':');
                const component = ctx as Context<APIMessageComponentInteraction>;
                switch (prefix) {
                    case 'event':
                        return newEventButton(component, args);
                    case 'events':
                        return eventsPageButton(component, args);
                }
                break;
            }

            case InteractionType.ApplicationCommandAutocomplete:
                if (interaction.data.name === 'schedule')
                    return scheduleAutocomplete(ctx as Context<APIApplicationCommandAutocompleteInteraction>);
                return { type: InteractionResponseType.ApplicationCommandAutocompleteResult, data: { choices: [] } };
        }
    } catch (err) {
        console.error(err);
        return errorReply(
            'Something went wrong. Please try again, and if it keeps happening let us know in the support server.',
        );
    }

    return errorReply('Unknown command. It may have been removed. Try `/help`.');
}
