import { CommandInteraction, MessageEmbed, ColorResolvable } from 'discord.js';
import config from '../config.json';

export const name = 'info';
export async function execute(interaction: CommandInteraction) {
    const infoEmbed = new MessageEmbed()
        .setTitle('What am I?')
        .setDescription(`I'm a free history bot built for communities to share their love for history, by learning and discussing together. All the events that are displayed are randomly selected from [Wikipedia](https://wikipedia.org/) using a custom API. If you are interested in supporting us, checkout our page on [Patreon](https://www.patreon.com/historicaleventsbot). All donations go directly towards the continued development and maintenance of the bot. \n\nIf you would like to suggest something, report a bug, need help, or want to keep up to date with the bot please join the [Historian Bot Support Server](${config.server_invite})`)
        .setColor(config.default_hex as ColorResolvable)
        .setFooter(config.default_footer);
    interaction.reply({ embeds: [infoEmbed], ephemeral: true });
}