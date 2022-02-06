import { Client, MessageEmbed, ColorResolvable, TextChannel } from 'discord.js';
import Keyv from 'keyv';
import getDailyEvent from '../utils/api/getDailyEvent';
import config from '../config.json';
import GuildData from '../Types/GuildData';
import getWeeklyEvents from '../utils/api/getWeeklyEvents';

export const name = 'eventsManager';
export async function execute(client: Client, database: Keyv) {
    const handleError = (guildData: GuildData, type: 'weekly'|'daily', id: string) => {
        guildData[type].channelId = null;
        if (guildData[type].pingRole) guildData[type].pingRole = null;
        database.set(`guild_data_${id}`, guildData);
    }

    setInterval(async () => {
        const date = new Date();
        if (date.getMinutes() === 0 && date.getSeconds() === 0) {
            const event = await getDailyEvent();
            const eventEmbed = new MessageEmbed()
                .setTitle(`${event.eventWeekDay}, ${event.month} ${event.day} (${event.year})`)
                .setURL(event.sourceURL)
                .setDescription(event.content)
                .setColor(config.default_hex as ColorResolvable)
                .setFooter({ text: `Daily Events • Randomly selected from ${event.totalEvents} events`, iconURL: config.default_footer.iconURL });;

            client.guilds.cache.map(g => g.id).forEach(async id => {
                const guildData: GuildData = await database.get(`guild_data_${id}`);
                if (guildData.daily.channelId) {
                    if (guildData.daily.time === date.getHours()) {
                        const dailyChannel = client.channels.cache.get(guildData.daily.channelId) as TextChannel;
                        if (dailyChannel) {
                            dailyChannel.send({ content: guildData.daily.pingRole ? `<@&${guildData.daily.pingRole}>` : undefined, embeds: [eventEmbed] }).catch(() => handleError(guildData, 'daily', id));
                        } else {
                            handleError(guildData, 'daily', id);
                        }
                    }
                }
            });
        }

        if (date.getDay() === 1 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            const weeklyEvents = await getWeeklyEvents();
            const eventsEmbed = new MessageEmbed()
                .setTitle(`Events this week (${weeklyEvents.events[0].month} ${weeklyEvents.events[0].day} - ${weeklyEvents.events[6].month} ${weeklyEvents.events[6].day})`)
                .setDescription('')
                .setColor(config.default_hex as ColorResolvable)
                .setFooter({ text: `Weekly Events • Randomly selected from an average of ${weeklyEvents.avgEvents} events per day`, iconURL: config.default_footer.iconURL });
            weeklyEvents.events.forEach(event => {
                eventsEmbed.setDescription(eventsEmbed.description + `\n\n**[${event.currentWeekDay}, ${event.month} ${event.day} (${event.year})](${event.sourceURL})** - ${event.content}`);
            });

            client.guilds.cache.map(g => g.id).forEach(async id => {
                const guildData: GuildData = await database.get(`guild_data_${id}`);
                if (guildData.weekly.channelId) {
                    if (guildData.weekly.time === date.getHours()) {
                        const weeklyChannel = client.channels.cache.get(guildData.weekly.channelId) as TextChannel;
                        if (weeklyChannel) {
                            weeklyChannel.send({ content: guildData.weekly.pingRole ? `<@&${guildData.weekly.pingRole}>` : undefined, embeds: [eventsEmbed] }).catch(() => handleError(guildData, 'weekly', id));
                        } else {
                            handleError(guildData, 'weekly', id);
                        }
                    }
                }
            });
        }
    }, 1000);
}