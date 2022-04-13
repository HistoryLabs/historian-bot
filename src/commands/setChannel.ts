import { CommandInteraction, MessageEmbed, Permissions, ColorResolvable } from 'discord.js';
import config from '../config.json';
import sendError from '../utils/sendError';
import sendReply from '../utils/sendReply';
import Database from '../utils/Database';

export const name = 'setChannel';
export async function execute(interaction: CommandInteraction, database: Database) {
    const guild = await database.findGuild(interaction.guildId);
    if (guild) {
        const type = interaction.options.getString('interval');
        const time = interaction.options.getString('time') ? parseInt(interaction.options.getString('time')) : 12;
        const pingRole = interaction.options.getRole('role');
        if (interaction.guild.members.cache.get(interaction.user.id).permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
                if (!guild.data[type].channelId) {
                    guild.data[type].channelId = interaction.channelId;
                    guild.data[type].time = time;
                    if (pingRole) guild.data[type].pingRole = pingRole.id;
                    guild.update(guild.data);
    
                    const successEmbed = new MessageEmbed()
                        .setTitle(`This channel will now receive ${type} events!`)
                        .setColor(config.default_hex as ColorResolvable)
                        .setFooter({
                            text: `${config.default_footer.text} • ${type === 'weekly' ? 'Weekly' : 'Daily'} Events`,
                            iconURL: config.default_footer.iconURL,
                        });
                    
                    const hours = (time + 11) % 12 + 1;
                    const suffix = time <= 11 ? 'AM' : 'PM';
                    const timeString = `${hours} ${suffix}`;
    
                    if (type === 'weekly') successEmbed.setDescription(`A message with historical events for each day of the week will now send in this channel every Monday at ${timeString} CST.`);
                    if (type === 'weekly' && pingRole) successEmbed.setDescription(`A message with historical events for each day of the week will now send in this channel every Monday at ${timeString} CST and it will ping <@&${pingRole.id}>.`);
                    if (type === 'daily') successEmbed.setDescription(`A message with a historical event for the day will now send in this channel everyday at ${timeString} CST.`);
                    if (type === 'daily' && pingRole) successEmbed.setDescription(`A message with a historical event for the day will now send in this channel everyday at ${timeString} CST and it will ping <@&${pingRole.id}>.`);
                    sendReply(interaction, { embeds: [successEmbed] });
                } else {
                    if (guild.data[type].channelId === interaction.channelId) {
                        sendError(interaction, `This channel is already set to receive ${type} events.`);
                    } else {
                        sendError(interaction, `<#${guild.data[type].channelId}> is already set to receive ${type} events.`);
                    }
                }
        } else {
            sendError(interaction, 'This command requires the `Manage Server` permission. You will have to contact your server administrator.');
        }
    } else {
        sendError(interaction, 'An error occurred. Please try again.');
    }
}