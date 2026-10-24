require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
  Events
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const VoiceManager = require('./voice/voiceManager');
const { loadSettings } = require('./utils/settings');

// Activity Type Resolver
const ActivityTypeMap = {
  Playing: ActivityType.Playing,
  Listening: ActivityType.Listening,
  Watching: ActivityType.Watching,
  Competing: ActivityType.Competing,
  Streaming: ActivityType.Streaming,
  Custom: ActivityType.Custom
};

// 1. Anti-Crash & Global Resilience Handlers
process.on('uncaughtException', (err, origin) => {
  logger.error('AntiCrash', `Uncaught Exception [${origin}]: ${err.message}`, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('AntiCrash', `Unhandled Rejection at:`, promise, `reason:`, reason);
});

process.on('warning', (warning) => {
  logger.warn('AntiCrash', `Process Warning: ${warning.name} - ${warning.message}`);
});

// 2. Validate Environment Variables
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const initialSettings = loadSettings();
const channelId = initialSettings.customChannelId || process.env.CHANNEL_ID;

if (!token) {
  logger.error('Startup', 'CRITICAL: DISCORD_TOKEN is not defined in .env! Exiting...');
  process.exit(1);
}

if (!guildId || !channelId) {
  logger.warn(
    'Startup',
    'GUILD_ID or CHANNEL_ID is not configured in .env. Bot will start but will not auto-join voice until configured.'
  );
}

// 3. Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Setup Commands Collection dynamically from src/commands/
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    logger.debug('Commands', `Loaded command: /${command.data.name}`);
  } else {
    logger.warn('Commands', `The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// VoiceManager instance reference
let voiceManager = null;

// 4. Client Lifecycle Events
client.once(Events.ClientReady, async (c) => {
  logger.info('ClientReady', `Logged in as ${c.user.tag} (ID: ${c.user.id})!`);

  // Load and apply persistent Rich Presence activity
  const settings = loadSettings();
  const act = settings.activity || {
    type: 'Listening',
    name: '24/7 Voice Channel | /help',
    status: 'online'
  };

  const activityPayload = {
    name: act.name,
    type: ActivityTypeMap[act.type] ?? ActivityType.Listening
  };
  if (act.type === 'Streaming' && act.url) {
    activityPayload.url = act.url;
  }

  c.user.setPresence({
    activities: [activityPayload],
    status: act.status || 'online'
  });
  logger.info('RichPresence', `Presence initialized: [${act.type}] "${act.name}" (${act.status || 'online'})`);

  // Initialize 24/7 Voice Manager
  const activeChannelId = settings.customChannelId || channelId;
  if (guildId && activeChannelId) {
    voiceManager = new VoiceManager(client, {
      guildId,
      channelId: activeChannelId,
      enableSilenceStream: process.env.ENABLE_SILENCE_STREAM !== 'false',
      healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS, 10) || 30000,
      maxReconnectDelayMs: parseInt(process.env.MAX_RECONNECT_DELAY_MS, 10) || 60000,
      selfDeaf: process.env.SELF_DEAF !== 'false',
      selfMute: process.env.SELF_MUTE === 'true'
    });

    await voiceManager.start();
  }
});

// Slash Command Interaction Handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn('Interaction', `Unknown command received: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction, voiceManager);
  } catch (err) {
    logger.error('Interaction', `Error executing /${interaction.commandName}: ${err.message}`, err);

    const errorMessage = '❌ An error occurred while executing this command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
    }
  }
});

// Voice State Tracking (Detect user moves, server disconnects)
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (oldState.id !== client.user?.id) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  if (oldChannelId && !newChannelId) {
    logger.warn('VoiceState', `Bot was disconnected from voice channel #${oldState.channel?.name || oldChannelId}.`);
  } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
    logger.voice('VoiceState', `Bot was moved from #${oldState.channel?.name} to #${newState.channel?.name}.`);
    // If moved to a different channel, the health-check or reconnect can re-anchor to configured channel
  }
});

// Gateway Connection Health Listeners
client.on(Events.Error, (err) => {
  logger.error('Client', `Discord Client Error: ${err.message}`, err);
});

client.on(Events.Warn, (info) => {
  logger.warn('Client', `Discord Client Warning: ${info}`);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn('Shard', `Shard #${shardId} disconnected (Code: ${event.code}, Clean: ${event.wasClean}).`);
});

client.on(Events.ShardReconnecting, (shardId) => {
  logger.info('Shard', `Shard #${shardId} is reconnecting...`);
});

client.on(Events.ShardResume, (shardId, replayedEvents) => {
  logger.info('Shard', `Shard #${shardId} resumed connection (${replayedEvents} events replayed).`);
});

// 5. Graceful Shutdown
const handleShutdown = async (signal) => {
  logger.info('Shutdown', `Received ${signal}. Gracefully stopping bot...`);
  if (voiceManager) {
    voiceManager.destroy();
  }
  try {
    client.destroy();
  } catch (err) {
    logger.error('Shutdown', `Error destroying client: ${err.message}`);
  }
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// 6. Login to Discord
client.login(token).catch((err) => {
  logger.error('Login', `Failed to login to Discord: ${err.message}`, err);
  process.exit(1);
});
