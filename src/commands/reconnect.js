const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reconnect')
    .setDescription('Memaksa bot untuk segera menghubungkan ulang koneksi voice (Khusus Admin).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('../voice/voiceManager')} voiceManager
   */
  async execute(interaction, voiceManager) {
    await interaction.deferReply({ ephemeral: true });

    if (!voiceManager) {
      return interaction.editReply({
        content: '❌ Voice Manager tidak aktif.'
      });
    }

    try {
      logger.voice('CommandReconnect', `Admin ${interaction.user.tag} memicu reconnect manual.`);
      await voiceManager.reconnectNow();

      const embed = new EmbedBuilder()
        .setTitle('🔄 Reconnect Voice Dijalankan')
        .setColor(0x3498db)
        .setDescription('Koneksi voice lama telah di-reset dan proses koneksi ulang sedang berlangsung.')
        .addFields(
          { name: 'Channel Target', value: `<#${voiceManager.channelId}>`, inline: true },
          { name: 'Guild ID', value: `\`${voiceManager.guildId}\``, inline: true }
        )
        .setFooter({
          text: `Diperintahkan oleh ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('CommandReconnect', `Error reconnecting voice: ${err.message}`, err);
      return interaction.editReply({
        content: `❌ Gagal reconnect: ${err.message}`
      });
    }
  }
};
