import { Client } from 'discord.js';
import chalk from 'chalk';
import GuildData from '../Types/GuildData';
import Database from '../utils/Database';

export const name = 'dataManager';
export async function execute(client: Client, database: Database, guildDataTemplate: GuildData) {
    let newGuilds: GuildData[] = [];
    const guilds = await database.guilds.find().toArray();
    const guildIds = guilds.map(g => g._id);
    client.guilds.cache.forEach(async g => {
        if (!guildIds.includes(g.id)) {
            newGuilds.push({
                ...guildDataTemplate,
                _id: g.id,
            });
        }

        if (g.id === client.guilds.cache.last().id) {
            await database.guilds.insertMany(newGuilds);
            console.log(`${chalk.yellow('[DataManager]')} Created guild data for ${newGuilds.length} guild(s)`);
        }
    });
}