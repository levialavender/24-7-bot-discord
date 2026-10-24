const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const reminderManager = require('../reminders/reminderManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('Kelola jadwal pengingat (reminders) kamu')
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Lihat semua daftar pengingat aktif milikmu')
    )
    .addSubcommand(sub =>
      sub
        .setName('cancel')
        .setDescription('Batalkan salah satu pengingat')
        .addStringOption(opt =>
          opt
            .setName('id')
            .setDescription('ID Pengingat yang ingin dibatalkan')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Hapus semua daftar pengingat aktif milikmu')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'list') {
      const list = reminderManager.listUserReminders(userId);

      if (list.length === 0) {
        return interaction.reply({
          content: '✨ Kamu belum memiliki pengingat yang aktif. Kamu bisa menyuruhku membuat pengingat lewat chat (misal: *"Ingatkan aku 30 menit lagi untuk mandi"*).',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('⏰ Daftar Pengingat Aktif Kamu')
        .setColor(0x5865f2)
        .setTimestamp();

      const fields = list.map((rem, idx) => {
        const timeStr = `<t:${Math.floor(rem.dueTimestamp / 1000)}:R> (<t:${Math.floor(rem.dueTimestamp / 1000)}:T>)`;
        return {
          name: `${idx + 1}. ${rem.message.substring(0, 50)}`,
          value: `🕒 Waktu: ${timeStr}\n🆔 ID: \`${rem.id}\`\n📍 Channel: <#${rem.channelId}>`
        };
      });

      embed.addFields(fields);
      embed.setFooter({ text: 'Gunakan /reminders cancel id:<id> untuk membatalkan pengingat' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'cancel') {
      const id = interaction.options.getString('id').trim();
      const success = reminderManager.deleteReminder(id, userId);

      if (success) {
        return interaction.reply({
          content: `✅ Pengingat dengan ID \`${id}\` berhasil dibatalkan.`,
          ephemeral: true
        });
      } else {
        return interaction.reply({
          content: `❌ Tidak ditemukan pengingat dengan ID \`${id}\` milikmu. Periksa ID dengan \`/reminders list\`.`,
          ephemeral: true
        });
      }
    }

    if (subcommand === 'clear') {
      const userReminders = reminderManager.listUserReminders(userId);
      for (const r of userReminders) {
        reminderManager.deleteReminder(r.id, userId);
      }

      return interaction.reply({
        content: `🗑️ Berhasil menghapus **${userReminders.length}** pengingat aktif milikmu.`,
        ephemeral: true
      });
    }
  }
};
