const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Mengeluarkan bot dari voice channel & menjeda auto-reconnect 24/7 (Khusus Admin).')
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
      logger.voice('CommandLeave', `Admin ${interaction.user.tag} mengeluarkan bot dari voice.`);
      voiceManager.leave();

      const embed = new EmbedBuilder()
        .setTitle('🚪 Bot Telah Meninggalkan Voice Channel')
        .setColor(0xe74c3c)
        .setDescription(
          'Bot telah diputuskan dari voice channel dan pemantauan 24/7 dijeda.\n' +
          'Gunakan perintah `/join` atau `/reconnect` untuk mengaktifkan kembali 24/7 Voice.'
        )
        .setFooter({
          text: `Diperintahkan oleh ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('CommandLeave', `Error leaving voice: ${err.message}`, err);
      return interaction.editReply({
        content: `❌ Gagal memutuskan koneksi: ${err.message}`
      });
    }
  }
};
