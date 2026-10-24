const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  StreamType,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const { SilenceStream } = require('./silenceStream');
const logger = require('../utils/logger');
const { formatDuration } = require('../utils/systemMetrics');

class VoiceManager {
  /**
   * @param {import('discord.js').Client} client
   * @param {Object} options
   * @param {string} options.guildId
   * @param {string} options.channelId
   * @param {boolean} [options.enableSilenceStream=true]
   * @param {number} [options.healthCheckIntervalMs=30000]
   * @param {number} [options.maxReconnectDelayMs=60000]
   * @param {boolean} [options.selfDeaf=true]
   * @param {boolean} [options.selfMute=false]
   */
  constructor(client, options) {
    this.client = client;
    this.guildId = String(options.guildId || '').trim().replace(/['"]/g, '');
    this.channelId = String(options.channelId || '').trim().replace(/['"]/g, '');
    this.enableSilenceStream = options.enableSilenceStream ?? true;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs || 30000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs || 60000;
    this.selfDeaf = options.selfDeaf ?? true;
    this.selfMute = options.selfMute ?? false;

    this.connection = null;
    this.player = null;
    this.silenceStream = null;

    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.healthCheckTimer = null;
    this.isReconnecting = false;
    this.connectedSince = null;
    this.isExplicitDisconnect = false;
  }

  /**
   * Initialize and join target voice channel, start health watchdog.
   */
  async start() {
    logger.voice('Manager', `Initializing 24/7 Voice connection for Guild ${this.guildId}, Channel ${this.channelId}...`);
    this.setupAudioPlayer();
    await this.connect();
    this.startHealthWatchdog();
  }

  /**
   * Creates audio player for dummy silence packets.
   */
  setupAudioPlayer() {
    if (!this.enableSilenceStream) return;

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
        maxMissedFrames: 250
      }
    });

    this.player.on('stateChange', (oldState, newState) => {
      logger.debug('AudioPlayer', `State changed: ${oldState.status} -> ${newState.status}`);
      if (newState.status === AudioPlayerStatus.Idle && this.enableSilenceStream) {
        // Automatically restart silence stream if it goes idle
        this.playSilence();
      }
    });

    this.player.on('error', (err) => {
      logger.error('AudioPlayer', `Audio player error: ${err.message}`, err);
      // Restart silence stream after brief delay
      setTimeout(() => this.playSilence(), 1000);
    });
  }

  /**
   * Transmits silence Opus frames to keep connection alive.
   */
  playSilence() {
    if (!this.player || !this.enableSilenceStream) return;
    try {
      if (this.silenceStream) {
        try {
          this.silenceStream.destroy();
        } catch {
          // ignore
        }
      }

      this.silenceStream = new SilenceStream();
      const resource = createAudioResource(this.silenceStream, {
        inputType: StreamType.Opus
      });

      this.player.play(resource);
      logger.debug('SilenceStream', 'Started silence stream transmission');
    } catch (err) {
      logger.error('SilenceStream', `Failed to start silence transmission: ${err.message}`);
    }
  }

  /**
   * Establish voice channel connection.
   */
  async connect() {
    if (this.isExplicitDisconnect) return;

    // Check if an active connection already exists in the target channel
    const existingConn = getVoiceConnection(this.guildId);
    if (existingConn) {
      if (
        existingConn.state.status === VoiceConnectionStatus.Ready &&
        existingConn.joinConfig.channelId === this.channelId
      ) {
        logger.debug('Manager', 'Voice connection is already Ready in the target channel.');
        return;
      }

      logger.warn(
        'Manager',
        `Found stale voice connection in state [${existingConn.state.status}]. Resetting before connecting...`
      );
      try {
        existingConn.destroy();
      } catch (err) {
        // ignore
      }
    }

    try {
      let guild = this.client.guilds.cache.get(this.guildId);
      if (!guild) {
        try {
          guild = await this.client.guilds.fetch(this.guildId);
        } catch (err) {
          logger.error('Manager', `Guild with ID ${this.guildId} could not be fetched: ${err.message}`);
          this.scheduleReconnect();
          return;
        }
      }

      let channel = guild.channels.cache.get(this.channelId);
      if (!channel) {
        try {
          channel = await guild.channels.fetch(this.channelId);
        } catch (err) {
          logger.error('Manager', `Voice channel with ID ${this.channelId} could not be fetched from guild: ${err.message}`);
          this.scheduleReconnect();
          return;
        }
      }

      if (channel && typeof channel.isVoiceBased === 'function' && !channel.isVoiceBased()) {
        logger.error('Manager', `Channel #${channel.name} (${this.channelId}) is NOT a Voice Channel! Please check CHANNEL_ID in .env.`);
        return;
      }

      // Check permissions
      const permissions = channel.permissionsFor(this.client.user);
      if (!permissions?.has(['Connect', 'Speak'])) {
        logger.error('Manager', `Missing CONNECT or SPEAK permission for voice channel: ${channel.name} (${channel.id})`);
      }

      logger.voice('Manager', `Connecting to voice channel: #${channel.name} (${channel.id})...`);

      this.connection = joinVoiceChannel({
        channelId: this.channelId,
        guildId: this.guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: this.selfDeaf,
        selfMute: this.selfMute
      });

      this.attachConnectionListeners(this.connection);

      // Wait up to 15 seconds for the connection to transition to Ready
      try {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
      } catch (err) {
        if (!this.isExplicitDisconnect && this.connection && this.connection.state.status !== VoiceConnectionStatus.Ready) {
          logger.warn(
            'Manager',
            `Voice connection failed to reach Ready state within 15s (Current status: ${this.connection.state.status}). Reconnecting...`
          );
          try {
            this.connection.destroy();
          } catch {}
          this.scheduleReconnect();
        }
      }
    } catch (err) {
      logger.error('Manager', `Connection error: ${err.message}`, err);
      this.scheduleReconnect();
    }
  }

  /**
   * Attach robust lifecycle listeners to VoiceConnection.
   * @param {import('@discordjs/voice').VoiceConnection} connection
   */
  attachConnectionListeners(connection) {
    connection.removeAllListeners();

    connection.on('error', (err) => {
      logger.error('VoiceConnection', `Connection error: ${err.message}`, err);
    });

    connection.on(VoiceConnectionStatus.Signalling, () => {
      logger.voice('Lifecycle', 'Status: Signalling (negotiating voice server details)...');
    });

    connection.on(VoiceConnectionStatus.Connecting, () => {
      logger.voice('Lifecycle', 'Status: Connecting (establishing UDP handshake)...');
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      logger.voice('Lifecycle', 'Status: Ready (Voice connection active and stable!)');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.connectedSince = Date.now();

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // Subscribe audio player to send keep-alive silence packets only if enabled
      if (this.player && this.enableSilenceStream) {
        try {
          connection.subscribe(this.player);
          this.playSilence();
        } catch (err) {
          logger.warn('Lifecycle', `Could not subscribe silence player: ${err.message}`);
        }
      }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async (_, newState) => {
      logger.warn('Lifecycle', `Status: Disconnected. Reason code: ${newState?.reason ?? 'Unknown'}`);
      this.connectedSince = null;

      if (this.isExplicitDisconnect) return;

      try {
        // According to discord.js documentation:
        // Wait up to 5s to see if connection automatically migrates / recovers
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
        logger.voice('Lifecycle', 'Connection recovering automatically through Signalling/Connecting state.');
      } catch {
        logger.warn('Lifecycle', 'Connection dropped and did not recover within 5s. Reconnecting...');
        this.isReconnecting = true;
        try {
          connection.destroy();
        } catch {
          // ignore
        }
        this.scheduleReconnect();
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      logger.warn('Lifecycle', 'Status: Destroyed.');
      this.connectedSince = null;
      if (!this.isExplicitDisconnect && !this.isReconnecting) {
        this.scheduleReconnect();
      }
    });

    connection.on('error', (err) => {
      logger.error('Lifecycle', `VoiceConnection internal error: ${err.message}`, err);
    });
  }

  /**
   * Exponential backoff reconnect strategy.
   */
  scheduleReconnect() {
    if (this.isExplicitDisconnect) return;
    if (this.reconnectTimeout) return; // Reconnect is already pending, avoid multiple parallel attempts

    this.isReconnecting = true;
    this.reconnectAttempts += 1;

    // Calculate delay with exponential backoff + jitter
    const baseDelay = 3000;
    const factor = Math.pow(1.5, Math.min(this.reconnectAttempts, 6));
    const jitter = Math.floor(Math.random() * 1000);
    const delay = Math.min(Math.floor(baseDelay * factor) + jitter, this.maxReconnectDelayMs);

    logger.voice('Reconnect', `Scheduling reconnect attempt #${this.reconnectAttempts} in ${delay}ms...`);

    this.reconnectTimeout = setTimeout(async () => {
      this.isReconnecting = false;
      this.reconnectTimeout = null;
      await this.connect();
    }, delay);
  }

  /**
   * Health-check watchdog loop to guarantee 24/7 persistence.
   */
  startHealthWatchdog() {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);

    this.healthCheckTimer = setInterval(async () => {
      if (this.isExplicitDisconnect || this.isReconnecting) return;

      const currentConn = getVoiceConnection(this.guildId);

      // 1. If connection is Ready and in the target channel, it is 100% fine. NEVER destroy it!
      if (currentConn && currentConn.state.status === VoiceConnectionStatus.Ready) {
        if (currentConn.joinConfig?.channelId === this.channelId) {
          logger.debug('HealthWatchdog', 'Health-check OK: Bot is connected and stable.');
          return;
        }
      }

      // 2. If it is currently connecting or signalling, allow it time to finish
      if (
        currentConn &&
        (currentConn.state.status === VoiceConnectionStatus.Connecting ||
          currentConn.state.status === VoiceConnectionStatus.Signalling)
      ) {
        this.connectingTicks = (this.connectingTicks || 0) + 1;
        if (this.connectingTicks >= 2) {
          logger.warn('HealthWatchdog', 'Voice connection stuck in Connecting/Signalling state for >30s. Resetting...');
          this.connectingTicks = 0;
          try {
            currentConn.destroy();
          } catch {}
          this.scheduleReconnect();
        } else {
          logger.debug('HealthWatchdog', 'Health-check: Connection in progress (Connecting/Signalling)...');
        }
        return;
      }
      this.connectingTicks = 0;

      // 3. Connection is missing, destroyed, or in a different channel without user intent
      logger.warn(
        'HealthWatchdog',
        `Voice connection lost or inactive (Status: ${currentConn?.state?.status ?? 'None'}). Triggering reconnect...`
      );

      this.scheduleReconnect();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Get current voice status for /status command.
   * @returns {Object}
   */
  getStatus() {
    const currentConn = getVoiceConnection(this.guildId);
    const guild = this.client.guilds.cache.get(this.guildId);
    const channel = guild?.channels.cache.get(this.channelId);
    const botMember = guild?.members.me;

    const state = currentConn ? currentConn.state.status : 'Disconnected';
    const isReady = state === VoiceConnectionStatus.Ready;

    let voiceUptime = 'Not connected';
    if (isReady && this.connectedSince) {
      const elapsedSeconds = (Date.now() - this.connectedSince) / 1000;
      voiceUptime = formatDuration(elapsedSeconds);
    }

    return {
      status: state,
      isReady,
      channelName: channel?.name || 'Unknown Channel',
      channelId: this.channelId,
      guildName: guild?.name || 'Unknown Guild',
      guildId: this.guildId,
      voiceUptime,
      reconnectAttempts: this.reconnectAttempts,
      silenceStreaming: this.enableSilenceStream && isReady && this.player?.state.status === AudioPlayerStatus.Playing,
      currentMemberChannel: botMember?.voice?.channel?.name || null,
      udpPing: currentConn?.ping?.udp ?? null
    };
  }

  /**
   * Switch or set target voice channel dynamically.
   * @param {string} newChannelId
   */
  async setChannel(newChannelId) {
    this.channelId = newChannelId;
    this.isExplicitDisconnect = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connection) {
      try {
        this.connection.destroy();
      } catch {
        // ignore
      }
    }

    await this.connect();
    this.startHealthWatchdog();
  }

  /**
   * Force an immediate reconnect.
   */
  async reconnectNow() {
    this.isExplicitDisconnect = false;
    this.reconnectAttempts = 0;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const currentConn = getVoiceConnection(this.guildId);
    if (currentConn) {
      try {
        currentConn.destroy();
      } catch {
        // ignore
      }
    }

    await this.connect();
    this.startHealthWatchdog();
  }

  /**
   * Leave voice channel and pause auto-reconnect watchdog.
   */
  leave() {
    this.isExplicitDisconnect = true;
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.silenceStream) {
      try {
        this.silenceStream.destroy();
      } catch {
        // ignore
      }
    }
    if (this.player) {
      try {
        this.player.stop();
      } catch {
        // ignore
      }
    }
    if (this.connection) {
      try {
        this.connection.destroy();
      } catch {
        // ignore
      }
    }
    this.connectedSince = null;
  }

  /**
   * Resume 24/7 connection after a manual leave.
   */
  async resume() {
    this.isExplicitDisconnect = false;
    await this.connect();
    this.startHealthWatchdog();
  }

  /**
   * Clean shutdown.
   */
  destroy() {
    this.leave();
  }
}

module.exports = VoiceManager;
