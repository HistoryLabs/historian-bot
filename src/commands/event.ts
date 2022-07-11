import { CommandInteraction, MessageButton, MessageActionRow } from 'discord.js';
import getDailyEvent from '../utils/api/getDailyEvent';
import sendError from '../utils/sendError';
import sendReply from '../utils/sendReply';
import generateEventEmbed from '../utils/generateEventEmbed';
import config from '../config.json';

export const name = 'event';
export async function execute(interaction: CommandInteraction) {
    const event = await getDailyEvent(() => sendError(interaction, 'An error occured while finding an event. Please try again.'));

    const findNewButton = new MessageButton()
        .setCustomId('FIND_NEW')
        .setStyle('PRIMARY')
        .setLabel('New Event')
        .setEmoji(config.emojis.refresh);

    const eventRow = new MessageActionRow({
        components: [findNewButton],
    });

    const eventEmbed = generateEventEmbed(event);

    const reply = await sendReply(interaction, { embeds: [eventEmbed], components: [eventRow], fetchReply: true });

    let isCollectorExpired: boolean = false;

    const collector = interaction.channel.createMessageComponentCollector({
        time: 300000,
        componentType: 'BUTTON',
        message: reply,
    });

    collector.on('collect', async (i) => {
        i.deferUpdate();

        if (i.user.id === interaction.user.id) {
            const newEvent = await getDailyEvent(() => sendError(i, 'Failed to find new event. Please try again.'));
            const newEmbed = generateEventEmbed(newEvent);

            const cooldownButton = new MessageButton().setCustomId('COOLDOWN').setDisabled(true).setStyle('DANGER').setLabel('30s Cooldown');

            i.editReply({ embeds: [newEmbed], components: [
                new MessageActionRow({
                    components: [cooldownButton],
                }),
            ]});

            setTimeout(() => {
                if (!isCollectorExpired) {
                    i.editReply({ components: [
                        new MessageActionRow({
                            components: [findNewButton],
                        })
                    ]});
                }
            }, 1000 * 30);
        } else {
            sendError(i, 'Only the original command executor can find new events.');
        }
    });

    setTimeout(() => {
        interaction.editReply({
            embeds: [eventEmbed],
            components: [],
        });

        isCollectorExpired = true;
    }, 300000);
}