const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { saveSettings } = require('../utils/settings');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Memindahkan bot ke voice channel tertentu untuk stay 24/7 (Khusus Admin).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Pilih Voice Channel tujuan.')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('../voice/voiceManager')} voiceManager
   */
  async execute(interaction, voiceManager) {
    await interaction.deferReply({ ephemeral: true });

    if (!voiceManager) {
      return interaction.editReply({
        content: '❌ Voice Manager belum aktif atau belum diinisialisasi.'
      });
    }

    const targetChannel = interaction.options.getChannel('channel');

    // Check permissions in target channel
    const permissions = targetChannel.permissionsFor(interaction.client.user);
    if (!permissions?.has(['Connect', 'Speak', 'ViewChannel'])) {
      return interaction.editReply({
        content: `❌ Bot tidak memiliki izin \`Connect\`, \`Speak\`, atau \`View Channel\` di channel **${targetChannel.name}**!`
      });
    }

    try {
      logger.voice('CommandJoin', `Admin ${interaction.user.tag} memindahkan bot ke #${targetChannel.name} (${targetChannel.id})`);

      // Switch target channel in voiceManager
      await voiceManager.setChannel(targetChannel.id);

      // Save custom channel setting
      saveSettings({ customChannelId: targetChannel.id });

      const embed = new EmbedBuilder()
        .setTitle('🎙️ Berhasil Pindah Voice Channel')
        .setColor(0x2ecc71)
        .setDescription(`Bot sekarang terhubung dan stay 24/7 di channel **${targetChannel.name}**.`)
        .addFields(
          { name: 'Channel', value: `<#${targetChannel.id}> (\`${targetChannel.name}\`)`, inline: true },
          { name: 'Channel ID', value: `\`${targetChannel.id}\``, inline: true }
        )
        .setFooter({
          text: `Diperintahkan oleh ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('CommandJoin', `Error joining channel: ${err.message}`, err);
      return interaction.editReply({
        content: `❌ Gagal bergabung ke voice channel: ${err.message}`
      });
    }
  }
};
