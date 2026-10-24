require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    logger.warn('DeployCommands', `The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  logger.error(
    'DeployCommands',
    'Missing DISCORD_TOKEN or CLIENT_ID in environment variables. Please check your .env file.'
  );
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info('DeployCommands', `Started refreshing ${commands.length} application (/) commands.`);

    if (guildId) {
      // Guild-specific commands update instantaneously
      logger.info('DeployCommands', `Registering commands for Guild ID: ${guildId}`);
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      logger.info('DeployCommands', `Successfully reloaded ${data.length} guild application (/) commands.`);
    } else {
      // Global commands can take up to an hour to cache across Discord
      logger.info('DeployCommands', 'Registering commands globally (Guild ID not specified).');
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      logger.info('DeployCommands', `Successfully reloaded ${data.length} global application (/) commands.`);
    }
  } catch (error) {
    logger.error('DeployCommands', `Failed to deploy commands: ${error.message}`, error);
    process.exit(1);
  }
})();
