import {  ColorResolvable, CommandInteraction, MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import sendError from '../utils/sendError';
import sendReply from '../utils/sendReply';
import getEvents from '../utils/api/getEvents';
import splitArray from '../utils/splitArray';
import config from '../config.json';

export const name = 'events';
export async function execute(interaction: CommandInteraction) {
    let month = interaction.options.getInteger('month');
    let date = interaction.options.getInteger('day');
    if (month >= 1 && month <= 12 && date >= 1 && date <= 30) {
        interaction.deferReply();

        const eventsData = await getEvents(month - 1, date, () => {
            sendError(interaction, `We were unable to find events for that date, please try again. If the issue persists, please create a ticket in the [Historian Bot Support Server](${config.server_invite}).`);
        });

        const eventsPages = splitArray(eventsData.events, 5);

        const eventsEmbed = new MessageEmbed()
            .setTitle(`${eventsData.month} ${eventsData.day}`)
            .setURL(eventsData.sourceURL)
            .setColor(config.default_hex as ColorResolvable)
            .setFooter({
                text: `${config.default_footer.text} • Page 1 of ${eventsPages.length}`,
                iconURL: config.default_footer.iconURL,
            });
        const backButton = new MessageButton()
            .setCustomId('PAGE_BACK')
            .setStyle('PRIMARY')
            .setDisabled(true)
            .setEmoji(config.emojis.arrow_left);
        const forwardButton = new MessageButton()
            .setCustomId('PAGE_FORWARD')
            .setStyle('PRIMARY')
            .setDisabled(eventsPages[1] === undefined)
            .setEmoji(config.emojis.arrow_right);
        const eventsButtons = new MessageActionRow({
            components: [backButton, forwardButton],
        });

        new Promise(resolve => {
            eventsPages[0].forEach((event, i) => {
                if (i === eventsPages[0].length - 1) resolve(null);
                eventsEmbed.addField(`Year: ${event.year}`, event.content);
            });
        }).then(() => {
            sendReply(interaction, { embeds: [eventsEmbed], components: [eventsButtons], fetchReply: true }).then(reply => {
                let currentPage = 0;

                const collector = interaction.channel.createMessageComponentCollector({
                    time: 300000,
                    componentType: 'BUTTON',
                    message: reply,
                });

                collector.on('collect', (i) => {
                    i.deferUpdate();

                    if (i.customId === 'PAGE_BACK') currentPage--;
                    if (i.customId === 'PAGE_FORWARD') currentPage++;

                    if (eventsPages[currentPage] === undefined) return;

                    eventsEmbed.setFields([]);
                    eventsPages[currentPage].forEach((event) => {
                        eventsEmbed.addField(`Year: ${event.year}`, event.content);
                    });

                    eventsEmbed.setFooter({
                        text: `${config.default_footer.text} • Page ${currentPage + 1} of ${eventsPages.length}`,
                        iconURL: config.default_footer.iconURL,
                    });

                    backButton.setDisabled(eventsPages[currentPage - 1] === undefined);
                    forwardButton.setDisabled(eventsPages[currentPage + 1] === undefined);

                    interaction.editReply({ embeds: [eventsEmbed], components: [new MessageActionRow({ components: [backButton, forwardButton]} )] });
                });

                collector.on('end', () => {
                    for (let i = 0; i < eventsButtons.components.length; i++) {
                        eventsButtons.components[i].setDisabled(true);
                    }

                    interaction.editReply({ components: [eventsButtons] });
                });
            });
        });
    } else {
        sendError(interaction, 'Please provide a valid date.');
    }
}