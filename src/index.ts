import * as fs from 'fs';
import { Client, Collection, MessageEmbed, Intents } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { AutoPoster } from 'topgg-autoposter';
import config from './config.json';
import apiTest from './tests/api.test';
import Keyv from 'keyv';
import wiki from 'wikijs';
import chalk from 'chalk';
import CollectionsObject from './Types/CollectionsObject';
import GuildData from './Types/GuildData';

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const collections: CollectionsObject = {
    events: new Collection<string, any>(),
    commands: new Collection<string, any>(),
}

const database = new Keyv('sqlite://database.sqlite');
database.on('error', err => console.error('Keyv connection error:', err));

const guildDataTemplate: GuildData = {
    weekly: {
        channelId: null,
        time: 12,
    },
    daily: {
        channelId: null,
        time: 12,
    }
}

if (process.env.NODE_ENV === 'DEV') {
    process.chdir('./src');                                        
} else {
    process.chdir('./dist');
}

// Handlers
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith(process.env.NODE_ENV === 'DEV' ? '.ts' : '.js'));
const eventFiles = fs.readdirSync('./events').filter(eventfile => eventfile.endsWith(process.env.NODE_ENV === 'DEV' ? '.ts' : '.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    collections.commands.set(command.name, command);
}

for (const eventfile of eventFiles) {
    const event = require(`./events/${eventfile}`);
    collections.events.set(event.name, event);
}

// Slash Commands
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Get a list of commands'),
    new SlashCommandBuilder().setName('info').setDescription('Learn more about the bot'),
    new SlashCommandBuilder().setName('setchannel').setDescription('Sets events to be sent to this channel').addStringOption(option => 
        option.setName('interval')
            .setDescription('The interval at which events are sent')
            .setRequired(true)
            .addChoice('Daily', 'daily')
            .addChoice('Weekly', 'weekly')
    ).addStringOption(option => 
        option.setName('time')
            .setDescription('The time you want events sent (in CST - default is 12 PM)')
            .addChoice('12 AM', '0').addChoice('1 AM', '1').addChoice('2 AM', '2')
            .addChoice('3 AM', '3').addChoice('4 AM', '4').addChoice('5 AM', '5')
            .addChoice('6 AM', '6').addChoice('7 AM', '7').addChoice('8 AM', '8')
            .addChoice('9 AM', '9').addChoice('10 AM', '10').addChoice('11 AM', '11')
            .addChoice('12 PM', '12').addChoice('1 PM', '13').addChoice('2 PM', '14')
            .addChoice('3 PM', '15').addChoice('4 PM', '16').addChoice('5 PM', '17')
            .addChoice('6 PM', '18').addChoice('7 PM', '19').addChoice('8 PM', '20')
            .addChoice('9 PM', '21').addChoice('10 PM', '22').addChoice('11 PM', '23'),
    ).addRoleOption(option => 
        option.setName('role').setDescription('A role to ping when events are sent')
    ),
    new SlashCommandBuilder().setName('removechannel').setDescription('Stops events from being sent to this channel').addStringOption(option => 
        option.setName('interval')
            .setDescription('The interval at which events are sent')
            .setRequired(true)
            .addChoice('Daily', 'daily')
            .addChoice('Weekly', 'weekly')
    ),
    new SlashCommandBuilder().setName('event').setDescription('Gives a historical event for the day'),
    new SlashCommandBuilder().setName('events').setDescription('Finds events for a specific date').addIntegerOption(option => 
        option.setName('month')
            .setDescription('The month of the date (1-12)')
            .setRequired(true)
    ).addIntegerOption(option => 
        option.setName('day')
            .setDescription('The day of the event (1-31)')
            .setRequired(true)
    ),
];

const rest = new REST({ version: '9' }).setToken(process.env.NODE_ENV === 'DEV' ? process.env.DEV_TOKEN : process.env.PROD_TOKEN);

console.log(`${chalk.yellow('[SlashCommands]')}  Started refreshing application (/) commands`);

rest.put(
    process.env.NODE_ENV == 'DEV' ? Routes.applicationGuildCommands('744091398453723167', '729930432342392883') : Routes.applicationCommands('743224756408549457'),
    { body: commands },
).then(() => {
    console.log(`${chalk.yellow('[SlashCommands]')} Successfully reloaded application (/) commands.`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || !interaction.channel) return;

    if (interaction.commandName === 'help') {
        collections.commands.get('help').execute(interaction);
    } else if (interaction.commandName === 'info') {
        collections.commands.get('info').execute(interaction);
    } else if (interaction.commandName === 'setchannel') {
        collections.commands.get('setChannel').execute(interaction, database);
    } else if (interaction.commandName === 'removechannel') {
        collections.commands.get('removeChannel').execute(interaction, database);
    } else if (interaction.commandName === 'event') {
        collections.commands.get('event').execute(interaction, config, MessageEmbed, wiki);
    } else if (interaction.commandName === 'events') {
        collections.commands.get('events').execute(interaction, config, MessageEmbed, wiki);
    }
});

// Events
client.once('ready', async () => {
    console.log(`${client.user.tag} is online!`);
    console.log(`- Guild Count: ${client.guilds.cache.size}\n- User Count: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`);
    apiTest();
    collections.events.get('eventsManager').execute(client, database);
    collections.events.get('dataManager').execute(client, database, guildDataTemplate);
    client.user.setActivity(`/help in ${client.guilds.cache.size} servers!`, {type: 'WATCHING'});
    if (process.env.NODE_ENV !== 'DEV') AutoPoster(process.env.DBL_TOKEN, client);
    setInterval(() => {
        client.user.setActivity(`/help in ${client.guilds.cache.size} servers!`, {type: 'WATCHING'});
    }, 1800000);
});

client.on('guildCreate', (guild) => {
    database.set(`guild_data_${guild.id}`, guildDataTemplate);
});

client.on('guildDelete', async (guild) => {
    const guildData: GuildData = await database.get(`guild_data_${guild.id}`);
    if (guildData) database.delete(`guild_data_${guild.id}`);
});

client.login(process.env.NODE_ENV === 'DEV' ? process.env.DEV_TOKEN : process.env.PROD_TOKEN);