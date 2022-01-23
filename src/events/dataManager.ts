import { Client } from 'discord.js';
import Keyv from 'keyv';
import chalk from 'chalk';
import GuildData from '../Types/GuildData';

export const name = 'dataManager';
export async function execute(client: Client, database: Keyv, guildDataTemplate: GuildData) {
    let guildCounter: number = 0;
    client.guilds.cache.forEach(async guild => {
        const guildData = await database.get(`guild_data_${guild.id}`);
        if (!guildData) {
            database.set(`guild_data_${guild.id}`, guildDataTemplate);
            guildCounter++;
        }

        if (guild.id === client.guilds.cache.last().id) console.log(`${chalk.yellow('[DataManager]')} Created guild data for ${guildCounter} guild(s)`)
    });
}