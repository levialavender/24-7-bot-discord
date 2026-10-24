const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { loadPersona, savePersona } = require('../ai/persona');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpersona')
    .setDescription('Ubah instruksi persona/kepribadian AI (Admin / Owner only)')
    .addStringOption(opt =>
      opt
        .setName('instruction')
        .setDescription('Prompt instruksi sistem baru untuk kepribadian bot AI')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt
        .setName('view')
        .setDescription('Lihat kepribadian/persona yang sedang aktif saat ini')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isView = interaction.options.getBoolean('view');
    const newInstruction = interaction.options.getString('instruction');

    if (isView || (!newInstruction && !isView)) {
      const current = loadPersona();
      const embed = new EmbedBuilder()
        .setTitle('🎭 Persona AI Saat Ini')
        .setColor(0xe91e63)
        .setDescription(`\`\`\`\n${current.systemInstruction.substring(0, 4000)}\n\`\`\``)
        .setFooter({ text: 'Gunakan /setpersona instruction:<teks baru> untuk mengubah persona.' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
      const updated = savePersona(newInstruction);
      const embed = new EmbedBuilder()
        .setTitle('✅ Persona AI Berhasil Diperbarui!')
        .setColor(0x43b581)
        .setDescription(`**Instruksi Baru:**\n\`\`\`\n${updated.systemInstruction.substring(0, 4000)}\n\`\`\``)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({
        content: `❌ Gagal menyimpan persona baru: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
