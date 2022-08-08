import { CommandInteraction, MessageButton, MessageActionRow, MessageEmbed, ColorResolvable } from 'discord.js';
import sendError from '../utils/sendError';
import sendReply from '../utils/sendReply';
import config from '../config.json';
import getEvents from '../utils/api/getEvents';
import Event from '../Types/Event';

export const name = 'event';
export async function execute(interaction: CommandInteraction) {
    const today = await getEvents(new Date().getMonth(), new Date().getDate(), () => sendError(interaction, 'An error occured while finding an event. Please try again.'));
    const event = today.getRandom();

    const findNewButton = new MessageButton()
        .setCustomId('FIND_NEW')
        .setStyle('PRIMARY')
        .setLabel('New Event')
        .setEmoji(config.emojis.refresh);

    const eventRow = new MessageActionRow({
        components: [findNewButton],
    });

    const eventEmbed = createEventEmbed(event, today.month, today.day, today.totalResults);

    const reply = await sendReply(interaction, { embeds: [eventEmbed], components: [eventRow], fetchReply: true });

    const collector = interaction.channel.createMessageComponentCollector({
        time: 300000,
        componentType: 'BUTTON',
        message: reply,
    });

    collector.on('collect', async (i) => {
        await i.deferUpdate();

        if (i.user.id === interaction.user.id) {
            const newEvent = today.getRandom();
            const newEmbed = createEventEmbed(newEvent, today.month, today.day, today.totalResults);

            i.editReply({ embeds: [newEmbed] });
        } else {
            sendError(i, 'Only the original command executor can find new events.');
        }
    });

    collector.on('end', () => {
        interaction.editReply({
            embeds: [eventEmbed],
            components: [],
        });
    });
}

const createEventEmbed = (event: Event, month: string, day: string, total: number) => {
    return new MessageEmbed()
        .setTitle(event.weekDay ? `${event.weekDay}, ${month} ${day} (${event.year})` : `${month} ${day}, ${event.year}`)
        .setURL(event.sourceUrl)
        .setDescription(event.content)
        .setColor(config.default_hex as ColorResolvable)
        .setFooter({
            text: `${config.default_footer.text} • Randomly selected from ${total} events`,
            iconURL: config.default_footer.iconURL,
        });
}