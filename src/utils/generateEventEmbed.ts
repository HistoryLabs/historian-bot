import { ColorResolvable, MessageEmbed } from 'discord.js';
import Event from '../Types/Event';
import config from '../config.json';

export default function generateEventEmbed(event: Event) {
    return new MessageEmbed()
        .setTitle(`${event.eventWeekDay}, ${event.month} ${event.day} (${event.year})`)
        .setURL(event.sourceURL)
        .setDescription(event.content)
        .setColor(config.default_hex as ColorResolvable)
        .setFooter({
            text: `${config.default_footer.text} • Randomly selected from ${event.totalEvents} events`,
            iconURL: config.default_footer.iconURL,
        });
}