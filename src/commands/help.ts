import { CommandInteraction, MessageEmbed, ColorResolvable } from 'discord.js';
import config from '../config.json';

export const name = 'help';
export async function execute(interaction: CommandInteraction) {
    const helpEmbed = new MessageEmbed()
        .setTitle('Historian Bot Commands')
        .setDescription('This shows you all available commands for the bot, if you would like to know what the bot does please type `/info`.\n```/help - Sends a message with all available commands for the bot and an invite to the support server.``````/info -  Sends a message with what the bot does and an invite to the support server.``````/event - Sends a message with a historical event for the day.``````/events <month> <day> - Shows a list of events for the specified date``````/setchannel <daily | weekly> <@role> - Sets the channel as the Historic Events Channel. It will send historical events daily or weekly. You must have the Manage Server permission to use this command.``````/removechannel <daily | weekly> - This command will stop daily or weekly historical events messages. You must have the Manage Server permission to use this command.```\nIf you would like to suggest something, report a bug, need help, or want to keep up to date with the bot please join the [Historical Events Bot Support Server](https://discord.gg/Pj68BQf).')
        .setColor(config.default_hex as ColorResolvable)
        .setFooter(config.default_footer);
    interaction.reply({ embeds: [helpEmbed], ephemeral: true, });
}