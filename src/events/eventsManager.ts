import { Client, MessageEmbed, ColorResolvable, TextChannel } from 'discord.js';
import config from '../config.json';
import GuildData from '../Types/GuildData';
import getWeeklyEvents from '../utils/api/getWeeklyEvents';
import Database from '../utils/Database';
import cron from 'node-cron';
import getEvents from '../utils/api/getEvents';

export const name = 'eventsManager';
export async function execute(client: Client, database: Database) {
    const handleError = (guildData: GuildData, type: 'weekly'|'daily', id: string) => {
        guildData[type].channelId = null;
        database.updateGuild(id, guildData);
    }

    cron.schedule('15 * * * *', async (date) => {
        const today = await getEvents(new Date().getMonth(), new Date().getDate());

        if (today === null) return;

        const event = today.getRandom();

        const eventEmbed = new MessageEmbed()
            .setTitle(`${event.weekDay ? `${event.weekDay}, ` : ''}${today.month} ${today.day} (${event.year})`)
            .setURL(event.sourceUrl)
            .setDescription(event.content)
            .setColor(config.default_hex as ColorResolvable)
            .setFooter({
                text: `Daily Events • Randomly selected from ${today.totalResults} events`,
                iconURL: config.default_footer.iconURL
            });

        const guildsCursor = database.guilds.find({ 'daily.time': date.getHours(), 'daily.channelId': { $ne: null } });
        const guildsArray = await guildsCursor.toArray();

        guildsArray.forEach(guild => {
            const dailyChannel = client.channels.cache.get(guild.daily.channelId) as TextChannel;
            if (dailyChannel) {
                dailyChannel.send({ content: guild.daily.pingRole ? `<@&${guild.daily.pingRole}>` : undefined, embeds: [eventEmbed] }).catch(() => handleError(guild, 'daily', guild._id));
            } else {
                handleError(guild, 'daily', guild._id);
            }
        });
    }, { timezone: 'America/Chicago' });

    cron.schedule('52 * * * *', async (date) => {
        const weeklyEvents = await getWeeklyEvents();
        const eventsEmbed = new MessageEmbed()
            .setTitle(`Events this week (${weeklyEvents.events[0].month} ${weeklyEvents.events[0].day} - ${weeklyEvents.events[6].month} ${weeklyEvents.events[6].day})`)
            .setDescription('')
            .setColor(config.default_hex as ColorResolvable)
            .setFooter({ text: `Weekly Events • Randomly selected from an average of ${weeklyEvents.avgEvents} events per day`, iconURL: config.default_footer.iconURL });
        weeklyEvents.events.forEach(event => {
            eventsEmbed.setDescription(eventsEmbed.description + `\n\n**[${event.currentWeekDay}, ${event.month} ${event.day} (${event.year})](${event.sourceUrl})** - ${event.content}`);
        });

        const guildsCursor = database.guilds.find({ 'weekly.time': date.getHours(), 'weekly.channelId': { $ne: null } });
        const guildsArray = await guildsCursor.toArray();

        guildsArray.forEach(guild => {
            const weeklyChannel = client.channels.cache.get(guild.weekly.channelId) as TextChannel;
            if (weeklyChannel) {
                weeklyChannel.send({ content: guild.weekly.pingRole ? `<@&${guild.weekly.pingRole}>` : undefined, embeds: [eventsEmbed] }).catch(() => handleError(guild, 'weekly', guild._id));
            } else {
                handleError(guild, 'weekly', guild._id);
            }
        });
    }, { timezone: 'America/Chicago' });
}