import { CommandInteraction, InteractionReplyOptions, Message } from 'discord.js';
import { APIMessage } from 'discord.js/node_modules/discord-api-types';

export default async function sendReply(interaction: CommandInteraction, options: InteractionReplyOptions): Promise<Message|APIMessage> {
    if (interaction.replied || interaction.deferred) {
        return interaction.editReply(options);
    } else {
        return interaction.reply(options).catch(() => {
            return interaction.followUp(options).catch(() => null);
        });
    } 
}