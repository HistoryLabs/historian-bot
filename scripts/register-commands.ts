// Registers the bot's slash commands with Discord, replacing any existing ones.
//
//   npm run register-commands                      # global (all servers, production)
//   npm run register-commands -- --guild <id>      # one server only (instant, for testing)
//
// Reads DISCORD_APPLICATION_ID and DISCORD_TOKEN from .dev.vars.
import { commands } from '../src/commands/definitions.ts';

const applicationId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_TOKEN;
if (!applicationId || !token) {
    console.error('DISCORD_APPLICATION_ID and DISCORD_TOKEN must be set in .dev.vars');
    process.exit(1);
}

const guildFlag = process.argv.indexOf('--guild');
const guildId = guildFlag === -1 ? null : process.argv[guildFlag + 1];

const path = guildId
    ? `/applications/${applicationId}/guilds/${guildId}/commands`
    : `/applications/${applicationId}/commands`;

const response = await fetch(`https://discord.com/api/v10${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
});

if (!response.ok) {
    console.error(`Discord returned ${response.status}:`, await response.text());
    process.exit(1);
}

const registered = await response.json() as { name: string }[];
console.log(`Registered ${registered.length} commands ${guildId ? `in guild ${guildId}` : 'globally'}: ${registered.map(c => `/${c.name}`).join(', ')}`);
