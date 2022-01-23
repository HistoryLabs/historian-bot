import { CommandInteraction, MessageEmbed, ColorResolvable } from 'discord.js';
import { error_hex } from '../config.json';

export default function sendError(interaction: CommandInteraction, message: string) {
    const errorEmbed = new MessageEmbed()
        .setDescription(message)
        .setColor(error_hex as ColorResolvable);

    if (interaction.replied || interaction.deferred) {
        interaction.editReply({ embeds: [errorEmbed] });
    } else {
        interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {
            interaction.followUp({ embeds: [errorEmbed] }).catch(() => null);
        });
    } 
}