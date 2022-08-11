import * as fs from 'fs';
import { Client, Collection, Intents } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { AutoPoster } from 'topgg-autoposter';
import apiTest from './tests/api.test';
import chalk from 'chalk';
import CollectionsObject from './Types/CollectionsObject';
import GuildData from './Types/GuildData';
import Database from './utils/Database';
import commands from './commands';

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const collections: CollectionsObject = {
    events: new Collection<string, any>(),
    commands: new Collection<string, any>(),
}

const database = new Database();

database.connect().then(() => {
    client.login(process.env.NODE_ENV === 'DEV' ? process.env.DEV_TOKEN : process.env.PROD_TOKEN);
});

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
        collections.commands.get('event').execute(interaction);
    } else if (interaction.commandName === 'events') {
        collections.commands.get('events').execute(interaction);
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
    database.addGuild(guild.id, guildDataTemplate);
});

client.on('guildDelete', async (guild) => {
    database.removeGuild(guild.id);
});