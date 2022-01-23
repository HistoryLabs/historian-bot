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
        if (date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            const event = await getDailyEvent();
            const eventEmbed = new MessageEmbed()
                .setTitle(`${event.eventWeekDay}, ${event.month} ${event.day} (${event.year})`)
                .setDescription(event.content)
                .setFooter(`Daily Events • Randomly selected from ${event.totalEvents} events`)
                .setColor(config.default_hex as ColorResolvable);

            client.guilds.cache.map(g => g.id).forEach(async id => {
                const guildData: GuildData = await database.get(`guild_data_${id}`);
                if (guildData.daily.channelId) {
                    const dailyChannel = client.channels.cache.get(guildData.daily.channelId) as TextChannel;
                    if (dailyChannel) {
                        dailyChannel.send({ content: guildData.daily.pingRole ? `<@&${guildData.daily.pingRole}>` : undefined, embeds: [eventEmbed] }).catch(() => handleError(guildData, 'daily', id));
                    } else {
                        handleError(guildData, 'daily', id);
                    }
                }
            });
        }

        if (date.getDay() === 1 && date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            const weeklyEvents = await getWeeklyEvents();
            const eventsEmbed = new MessageEmbed()
                .setTitle(`Events this week (${weeklyEvents.events[0].month} ${weeklyEvents.events[0].day} - ${weeklyEvents.events[6].month} ${weeklyEvents.events[6].day})`)
                .setDescription('')
                .setFooter(`Weekly Events • Randomly selected from an average of ${weeklyEvents.avgEvents} events per day`)
                .setColor(config.default_hex as ColorResolvable);
            weeklyEvents.events.forEach(event => {
                eventsEmbed.setDescription(eventsEmbed.description + `\n\n**${event.currentWeekDay}, ${event.month} ${event.day} (${event.year})** - ${event.content}`);
            });

            client.guilds.cache.map(g => g.id).forEach(async id => {
                const guildData: GuildData = await database.get(`guild_data_${id}`);
                if (guildData.weekly.channelId) {
                    const weeklyChannel = client.channels.cache.get(guildData.weekly.channelId) as TextChannel;
                    if (weeklyChannel) {
                        weeklyChannel.send({ content: guildData.weekly.pingRole ? `<@&${guildData.weekly.pingRole}>` : undefined, embeds: [eventsEmbed] }).catch(() => handleError(guildData, 'weekly', id));
                    } else {
                        handleError(guildData, 'weekly', id);
                    }
                }
            });
        }
    }, 1000);















//     const monthsArray = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
//     const daysArray = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th', '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th', '29th', '30th', '31st'];
//     const weekDaysArray = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

//     eventMessages();

//     async function eventMessages() {
//         setInterval(async () => {
//             let date = new Date();
//             if (date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0) {
//                 let historicalEventEmbed = null;
//                 await getHistoricalEventForDay(monthsArray[date.getMonth()], date.getDate()).then(res => {
//                     historicalEventEmbed = new MessageEmbed()
//                         .setTitle(`${weekDaysArray[date.getDay()]}, ${res.month} ${res.day} (${res.year}):`)
//                         .setDescription(res.content)
//                         .setFooter(`Daily Historical Event • Randomly selected from ${res.totalEvents} events`)
//                         .setColor(config.default_hex);
//                 }).then(async () => {
//                     let dailyChannelIds = await database.get('dailyChannelIds');
//                     let dailyChannelData = await database.get('dailyChannelData');
//                     let failCounter = 0;
//                     for (let i = 0; i < dailyChannelIds.length; i++) {
//                         const historyChannel = client.channels.cache.get(dailyChannelIds[i]);
//                         const channelData = dailyChannelData.find(a => a.channelId === dailyChannelIds[i]);
//                         if (channelData) {
//                             try {
//                                 await historyChannel.send({ content: `<@&${channelData.pingRole}>`, embeds: [historicalEventEmbed]}).catch(() => null);
//                             } catch (error) {
//                                 failCounter++;
//                             }
//                         } else {
//                             try {
//                                 await historyChannel.send({ embeds: [historicalEventEmbed]}).catch(() => null);
//                             } catch (error) {
//                                 failCounter++;
//                             }
//                         }
//                     }
//                     console.log(`[DAILY] Failed to send to ${failCounter} channel(s) out of ${dailyChannelIds.length}...`);
//                 });
//             }

//             if (date.getDay() === 1 && date.getHours() === 12 && date.getMinutes() === 0 && date.getSeconds() === 0) {
//                 let historicalEventsEmbed = null;
//                 getHistoricalEventsForWeek().then(result => {
//                     let res = result.events;
//                     if (Array.isArray(res)) {
//                         historicalEventsEmbed = new MessageEmbed()
//                             .setTitle(`Historical Events this week (${res[0].month} ${res[0].day} - ${res[6].month} ${res[6].day}):`)
//                             .setDescription(`**Monday, ${res[0].month} ${res[0].day} (${res[0].year})** - ${res[0].content}\n\n**Tuesday, ${res[1].month} ${res[1].day} (${res[1].year})** - ${res[1].content}\n\n**Wednesday, ${res[2].month} ${res[2].day} (${res[2].year})** - ${res[2].content}\n\n**Thursday, ${res[3].month} ${res[3].day} (${res[3].year})** - ${res[3].content}\n\n**Friday, ${res[4].month} ${res[4].day} (${res[4].year})** - ${res[4].content}\n\n**Saturday, ${res[5].month} ${res[5].day} (${res[5].year})** - ${res[5].content}\n\n**Sunday, ${res[6].month} ${res[6].day} (${res[6].year})** - ${res[6].content}`)
//                             .setFooter(`Weekly Historical Events • Randomly selected from an average of ${Math.round(result.avgTotal)} events per day`)
//                             .setColor(config.default_hex);
//                     } else {
//                         return;
//                     }
//                 }).then(async () => {
//                     let weeklyChannelIds = await database.get('channelIds');
//                     let weeklyChannelData = await database.get('weeklyChannelData');
//                     let failCounter = 0;
//                     for (let i = 0; i < weeklyChannelIds.length; i++) {
//                         const historyChannel = client.channels.cache.get(weeklyChannelIds[i]);
//                         const channelData = weeklyChannelData.find(a => a.channelId === weeklyChannelIds[i]);
//                         if (channelData) {
//                             try {
//                                 await historyChannel.send({ content: `<@&${channelData.pingRole}>`, embeds: [historicalEventsEmbed]}).catch(() => null);
//                             } catch (error) {
//                                 failCounter++;
//                             }
//                         } else {
//                             try {
//                                 await historyChannel.send({ embeds: [historicalEventsEmbed]}).catch(() => null);
//                             } catch (error) {
//                                 failCounter++;
//                             }
//                         }
//                     }
//                     console.log(`[WEEKLY] Failed to send to ${failCounter} channel(s) out of ${weeklyChannelIds.length}...`);
//                 });
//             }
//         }, 30000);
//     }

//     async function getHistoricalEventForDay(month, day) {
//         return wiki().page(`${month}_${day}`).then(page => page.sections('Events')).then(result => {
//             let eventsString;
//             if (result[0].items) {
//                 eventsString = `${result[0].items[0].content}\n${result[0].items[1].content}`;
//             } else {
//                 eventsString = result[0].content;
//             }
//             const eventsStringArray = eventsString.split('\n');
//             const events = eventsStringArray.map(eventsString => {
//                 const splitEvent = eventsString.split(' – ');

//                 return ({
//                     month: month,
//                     day: daysArray[day - 1],
//                     year: parseInt(splitEvent[0].replace(/[a-z, A-Z]/g, '')),
//                     content: splitEvent[1],
//                     totalEvents: eventsStringArray.length,
//                     statusCode: 0
//                 });
//             });
        
//             return events[Math.floor(Math.random() * events.length)];
//         }).catch(err => {
//             console.error(err);
//             return ({
//                 statusCode: 1,
//                 error: err,
//             });
//         });
//     }
    
//     async function getHistoricalEventsForWeek() {
//         const average = (array) => array.reduce((a, b) => a + b) / array.length;
//         const date = new Date();
//         const events = [];
//         return new Promise(resolve => {
//             const totalEvents = [];
//             const interval = setInterval(async () => {
//                 const event = await getHistoricalEventForDay(monthsArray[date.getMonth()], date.getDate());
//                 totalEvents.push(event.totalEvents);
//                 events.push(event);
//                 date.setDate(date.getDate() + 1);
//                 if (events.length === 7) {
//                     let failCounter = 0;
//                     let failedIndexes = [];
//                     events.forEach((event, i) => {
//                         if (event.statusCode === 1) {
//                             failCounter++;
//                             failedIndexes.push(i);
//                         }
//                     });
//                     if (failCounter > 0) {
//                         console.log('\x1b[31m%s\x1b[0m', 'ERROR (statusCode: 1):' + '\x1b[0m', `Failed to gather ${failCounter} event(s)!`);
//                         const resolveMessage = 'ERR:';
//                         failedIndexes.forEach(index => {
//                             resolveMessage = resolveMessage + '\n\n```' + events[index].error + '```';
//                         });
//                         resolve(resolveMessage);
//                     } else {
//                         console.log('\x1b[32m%s\x1b[0m', 'Success (statusCode: 0):' + '\x1b[0m', 'All events were successfully gathered!');
//                         resolve({
//                             events: events,
//                             avgTotal: average(totalEvents),
//                         });
//                     }
//                     clearInterval(interval);
//                 }
//             }, 5000);
//         });
//     }
}