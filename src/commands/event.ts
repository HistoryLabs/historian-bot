import { CommandInteraction, MessageEmbed, ColorResolvable } from 'discord.js';
import getDailyEvent from '../utils/api/getDailyEvent';
import sendError from '../utils/sendError';
import sendReply from '../utils/sendReply';
import config from '../config.json';

export const name = 'event';
export async function execute(interaction: CommandInteraction) {
    const event = await getDailyEvent(() => sendError(interaction, 'An error occured while getting an event. Please try again.'));
    const eventEmbed = new MessageEmbed()
        .setTitle(`${event.eventWeekDay}, ${event.month} ${event.day} (${event.year})`)
        .setDescription(event.content)
        .setColor(config.default_hex as ColorResolvable)
        .setFooter({
            text: `${config.default_footer.text} • Randomly selected from ${event.totalEvents} events`,
            iconURL: config.default_footer.iconURL,
        });
    sendReply(interaction, { embeds: [eventEmbed] });
}