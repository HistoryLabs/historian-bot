import { CommandInteraction, MessageEmbed, Permissions, ColorResolvable } from 'discord.js';
import Keyv from 'keyv';
import config from '../config.json';
import GuildData from '../Types/GuildData';
import sendError from '../utils/sendError';
import sendReply from '../utils/sendReply';

export const name = 'setChannel';
export async function execute(interaction: CommandInteraction, database: Keyv) {
    const guildData: GuildData = await database.get(`guild_data_${interaction.guildId}`);
    const type = interaction.options.getString('interval');
    const time = interaction.options.getString('time');
    const pingRole = interaction.options.getRole('role');
    if (interaction.guild.members.cache.get(interaction.user.id).permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
            if (!guildData[type].channelId) {
                guildData[type].channelId = interaction.channelId;
                guildData[type].time = time ? parseInt(time) : 12;
                if (pingRole) guildData[type].pingRole = pingRole.id;
                database.set(`guild_data_${interaction.guildId}`, guildData);

                const successEmbed = new MessageEmbed()
                    .setTitle(`This channel will now receive ${type} events!`)
                    .setColor(config.default_hex as ColorResolvable)
                    .setFooter({
                        text: `${config.default_footer.text} • ${type === 'weekly' ? 'Weekly' : 'Daily'} Events`,
                        iconURL: config.default_footer.iconURL,
                    });
                
                const hours = ((parseInt(time) + 11) % 12 + 1);
                const suffix = parseInt(time) <= 11 ? 'AM' : 'PM';
                const timeString = `${hours} ${suffix}`;

                if (type === 'weekly') successEmbed.setDescription(`A message with historical events for each day of the week will now send in this channel every Monday at ${timeString} CST.`);
                if (type === 'weekly' && pingRole) successEmbed.setDescription(`A message with historical events for each day of the week will now send in this channel every Monday at ${timeString} CST and it will ping <@&${pingRole.id}>.`);
                if (type === 'daily') successEmbed.setDescription(`A message with a historical event for the day will now send in this channel everyday at ${timeString} CST.`);
                if (type === 'daily' && pingRole) successEmbed.setDescription(`A message with a historical event for the day will now send in this channel everyday at ${timeString} CST and it will ping <@&${pingRole.id}>.`);
                sendReply(interaction, { embeds: [successEmbed] });
            } else {
                if (guildData[type].channelId === interaction.channelId) {
                    sendError(interaction, `This channel is already set to receive ${type} events.`);
                } else {
                    sendError(interaction, `<#${guildData[type].channelId}> is already set to receive ${type} events.`);
                }
            }
    } else {
        sendError(interaction, 'This command requires the `Manage Server` permission. You will have to contact your server administrator.');
    }
}