import { CommandInteraction, MessageEmbed, Permissions, ColorResolvable } from 'discord.js';
import config from '../config.json';
import sendError from '../utils/sendError';
import sendReply from '../utils/sendReply';
import Database from '../utils/Database';

export const name = 'removeChannel';
export async function execute(interaction: CommandInteraction, database: Database) {
    if (interaction.guild.members.cache.get(interaction.user.id).permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
        const guild = await database.findGuild(interaction.guildId);
        if (guild) {
            const type = interaction.options.getString('interval');
            if (guild.data[type].channelId === interaction.channelId) {
                guild.data[type].channelId = null;
                guild.update(guild.data);
                const successEmbed = new MessageEmbed()
                    .setDescription(`This channel will no longer receive ${type} events.`)
                    .setColor(config.default_hex as ColorResolvable);
                sendReply(interaction, { embeds: [successEmbed] });
            } else {
                sendError(interaction, `This channel is not set to receive ${type} events.`);
            }
        } else {
            sendError(interaction, 'An error occurred. Please try again.')
        }
    }
}