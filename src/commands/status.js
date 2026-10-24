const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSystemMetrics } = require('../utils/systemMetrics');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Displays bot uptime, VPS system metrics, voice connection status, and latency.'),

  /**
   * Execute status command.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('../voice/voiceManager')} voiceManager
   */
  async execute(interaction, voiceManager) {
    // Measure API round-trip latency
    const initialTimestamp = Date.now();
    await interaction.deferReply();
    const apiLatency = Date.now() - initialTimestamp;
    const wsPing = interaction.client.ws.ping;

    // Fetch metrics
    const metrics = await getSystemMetrics();
    const voiceStatus = voiceManager ? voiceManager.getStatus() : null;

    // Determine status color and emoji
    let statusColor = 0x2ecc71; // Green
    let statusEmoji = '🟢';
    let statusText = 'Online & Connected';

    if (!voiceStatus || !voiceStatus.isReady) {
      if (voiceStatus && voiceStatus.status === 'connecting') {
        statusColor = 0xf39c12; // Orange
        statusEmoji = '🟡';
        statusText = 'Connecting...';
      } else {
        statusColor = 0xe74c3c; // Red
        statusEmoji = '🔴';
        statusText = voiceStatus ? voiceStatus.status : 'Disconnected';
      }
    }

    // Get current activity
    const currentActivity = interaction.client.user.presence?.activities?.[0];
    const presenceDesc = currentActivity
      ? `${currentActivity.type !== undefined ? ['Playing', 'Streaming', 'Listening to', 'Watching', 'Custom', 'Competing in'][currentActivity.type] || '' : ''} "${currentActivity.name}"`
      : 'Default';

    const embed = new EmbedBuilder()
      .setTitle('📊 24/7 Voice Bot & VPS Diagnostics')
      .setColor(statusColor)
      .setDescription(
        `Bot berjalan dengan **24/7 Voice Gateway Watchdog** dan **Auto-Recovery**.\n` +
        `**Status Koneksi:** ${statusEmoji} \`${statusText}\``
      )
      .addFields(
        {
          name: '🎙️ Status Voice',
          value: voiceStatus
            ? [
                `**Channel:** \`#${voiceStatus.channelName}\` (<#${voiceStatus.channelId}>)`,
                `**Status Gateway:** \`${voiceStatus.status}\``,
                `**Voice Uptime:** \`${voiceStatus.voiceUptime}\``,
                `**Silence Keep-Alive:** ${voiceStatus.silenceStreaming ? '`Aktif (Streaming)`' : '`Tidak Aktif`'}`,
                `**Total Reconnect:** \`${voiceStatus.reconnectAttempts}\``
              ].join('\n')
            : 'Voice manager belum diinisialisasi',
          inline: false
        },
        {
          name: '⏱️ Uptime',
          value: [
            `**Bot Uptime:** \`${metrics.botUptime}\``,
            `**VPS Uptime:** \`${metrics.systemUptime}\``
          ].join('\n'),
          inline: true
        },
        {
          name: '📡 Latensi',
          value: [
            `**WS Ping:** \`${wsPing >= 0 ? `${wsPing}ms` : 'Menghitung...'}\``,
            `**API Latency:** \`${apiLatency}ms\``,
            voiceStatus?.udpPing ? `**UDP Ping:** \`${voiceStatus.udpPing}ms\`` : null
          ].filter(Boolean).join('\n'),
          inline: true
        },
        {
          name: '🎭 Rich Presence Aktif',
          value: `\`${presenceDesc}\` (${interaction.client.user.presence?.status?.toUpperCase() || 'ONLINE'})`,
          inline: false
        },
        {
          name: '🖥️ Resource VPS & Sistem',
          value: [
            `**Beban CPU:** \`${metrics.cpu.load}\` (${metrics.cpu.cores} Cores - ${metrics.cpu.model.trim()})`,
            `**Penggunaan RAM:** \`${metrics.memory.used} / ${metrics.memory.total}\` (\`${metrics.memory.percent}\`)`,
            `**Memori Bot (RSS):** \`${metrics.memory.processRss}\``,
            `**Sistem Operasi:** \`${metrics.os.platform}\``,
            `**Versi Node.js:** \`${metrics.os.nodeVersion}\``
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({
        text: `24/7 Discord Voice Bot • Requested by ${interaction.user.tag}`,
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
