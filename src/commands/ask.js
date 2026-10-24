const { SlashCommandBuilder } = require('discord.js');
const geminiService = require('../ai/geminiClient');
const { splitMessage } = require('../utils/messageSplitter');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Tanya apa saja ke AI (Google Gemini)')
    .addStringOption(option =>
      option
        .setName('prompt')
        .setDescription('Pertanyaan atau permintaan kamu ke AI')
        .setRequired(true)
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');

    // Defer reply because AI generation can take a few seconds
    await interaction.deferReply();

    try {
      const response = await geminiService.chat({
        prompt,
        userId: interaction.user.id,
        userName: interaction.user.displayName || interaction.user.username,
        channelId: interaction.channelId,
        guildId: interaction.guildId
      });

      const fullReply = `> 💬 **${prompt}**\n\n${response.text}`;
      const chunks = splitMessage(fullReply, 1950);

      // Send first chunk as editReply
      await interaction.editReply({ content: chunks[0] });

      // Follow up with any remaining chunks
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ content: chunks[i] });
      }
    } catch (err) {
      logger.error('Command:Ask', `Error processing /ask: ${err.message}`, err);
      await interaction.editReply({
        content: `❌ Gagal memproses pertanyaan kamu: ${err.message}`
      });
    }
  }
};
