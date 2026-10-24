const { SlashCommandBuilder, PermissionFlagsBits, ActivityType, EmbedBuilder } = require('discord.js');
const { saveSettings } = require('../utils/settings');
const logger = require('../utils/logger');

const ActivityTypeMap = {
  Playing: ActivityType.Playing,
  Listening: ActivityType.Listening,
  Watching: ActivityType.Watching,
  Competing: ActivityType.Competing,
  Streaming: ActivityType.Streaming,
  Custom: ActivityType.Custom
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setactivity')
    .setDescription('Mengubah Rich Presence / Status Aktivitas Bot (Khusus Admin).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Teks status aktivitas yang ingin ditampilkan.')
        .setRequired(true)
        .setMaxLength(128)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Tipe aktivitas bot.')
        .setRequired(false)
        .addChoices(
          { name: '🎧 Listening (Mendengarkan)', value: 'Listening' },
          { name: '🎮 Playing (Bermain)', value: 'Playing' },
          { name: '📺 Watching (Menonton)', value: 'Watching' },
          { name: '🏆 Competing (Bertanding)', value: 'Competing' },
          { name: '🟣 Streaming (Live Twitch/YT)', value: 'Streaming' },
          { name: '💬 Custom Status', value: 'Custom' }
        )
    )
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Status online bot.')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Online', value: 'online' },
          { name: '🟡 Idle (AFK)', value: 'idle' },
          { name: '🔴 Do Not Disturb (DND)', value: 'dnd' },
          { name: '⚪ Invisible', value: 'invisible' }
        )
    )
    .addStringOption(option =>
      option
        .setName('stream_url')
        .setDescription('URL Twitch/YouTube (Hanya jika memilih tipe Streaming).')
        .setRequired(false)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name');
    const typeStr = interaction.options.getString('type') || 'Listening';
    const status = interaction.options.getString('status') || 'online';
    const streamUrl = interaction.options.getString('stream_url');

    const activityType = ActivityTypeMap[typeStr] ?? ActivityType.Listening;

    // Validate streaming URL if streaming type is selected
    if (typeStr === 'Streaming' && (!streamUrl || !streamUrl.startsWith('https://'))) {
      return interaction.editReply({
        content: '⚠️ Jika memilih tipe **Streaming**, kamu harus menyertakan opsi `stream_url` yang valid (dimulai dengan https://).'
      });
    }

    try {
      const activityData = {
        name,
        type: activityType
      };

      if (typeStr === 'Streaming' && streamUrl) {
        activityData.url = streamUrl;
      }

      // Apply Rich Presence to Discord Client
      interaction.client.user.setPresence({
        activities: [activityData],
        status: status
      });

      // Persist to settings.json
      saveSettings({
        activity: {
          name,
          type: typeStr,
          status,
          url: streamUrl || null
        }
      });

      logger.info('RichPresence', `Activity updated by ${interaction.user.tag}: ${typeStr} "${name}" [${status}]`);

      const embed = new EmbedBuilder()
        .setTitle('✅ Rich Presence Bot Berhasil Diperbarui!')
        .setColor(0x2ecc71)
        .setDescription('Aktivitas bot berhasil diubah dan disimpan secara otomatis.')
        .addFields(
          { name: '🏷️ Tipe Aktivitas', value: `\`${typeStr}\``, inline: true },
          { name: '📝 Teks Status', value: `\`${name}\``, inline: true },
          { name: '🟢 Status Online', value: `\`${status.toUpperCase()}\``, inline: true },
          ...(typeStr === 'Streaming' && streamUrl
            ? [{ name: '🔗 Stream URL', value: `[Klik Di Sini](${streamUrl})`, inline: false }]
            : [])
        )
        .setFooter({
          text: `Diperbarui oleh ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('RichPresence', `Gagal mengubah status: ${err.message}`, err);
      return interaction.editReply({
        content: `❌ Gagal mengubah Rich Presence bot: ${err.message}`
      });
    }
  }
};
