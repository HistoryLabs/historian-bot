import { Client } from 'discord.js';
import chalk from 'chalk';
import GuildData from '../Types/GuildData';
import Database from '../utils/Database';

export const name = 'dataManager';
export async function execute(client: Client, database: Database, guildDataTemplate: GuildData) {
    let guildCounter: number = 0;
    client.guilds.cache.forEach(async g => {
        let guild = await database.findGuild(g.id);
        if (!guild) {
            database.addGuild(g.id, guildDataTemplate);
            guildCounter++;
        } else {
            if (!guild.data.daily.time) {
                guild.data.daily.time = 12;
                guild.update(guild.data);
            }

            if (!guild.data.weekly.time) {
                guild.data.weekly.time = 12;
                guild.update(guild.data);
            }
        }

        if (g.id === client.guilds.cache.last().id) console.log(`${chalk.yellow('[DataManager]')} Created guild data for ${guildCounter} guild(s)`);
    });
}