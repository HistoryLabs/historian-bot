import { CommandInteraction, MessageEmbed, Permissions, ColorResolvable } from 'discord.js';
import Keyv from 'keyv';
import config from '../config.json';
import GuildData from '../Types/GuildData';
import sendError from '../utils/sendError';
import sendReply from '../utils/sendReply';

export const name = 'removeChannel';
export async function execute(interaction: CommandInteraction, database: Keyv) {
    if (interaction.guild.members.cache.get(interaction.user.id).permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
        const guildData: GuildData = await database.get(`guild_data_${interaction.guildId}`);
        const type = interaction.options.getString('interval');
        if (guildData[type].channelId === interaction.channelId) {
            guildData[type].channelId = null;
            database.set(`guild_data_${interaction.guildId}`, guildData);
            const successEmbed = new MessageEmbed()
                .setDescription(`This channel will no longer receive ${type} events.`)
                .setColor(config.default_hex as ColorResolvable);
            sendReply(interaction, { embeds: [successEmbed] });
        } else {
            sendError(interaction, `This channel is not set to receive ${type} events.`);
        }
    }
}