const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Menampilkan daftar perintah dan panduan bot 24/7 Voice.'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Panduan & Daftar Slash Commands')
      .setColor(0x5865f2)
      .setDescription(
        'Bot ini dirancang untuk **stay 24/7 di Voice Channel** dengan auto-reconnect, proteksi gateway silence, dan monitoring real-time.'
      )
      .addFields(
        {
          name: '📊 Perintah Umum',
          value: [
            '• `/status` - Menampilkan metrik bot, status koneksi voice, latensi, dan resource VPS (CPU/RAM/Uptime).',
            '• `/ask <prompt>` - Tanya apa saja ke AI (9Router AI).',
            '• `/reminders <list|cancel|clear>` - Kelola jadwal pengingat (reminders) aktif kamu.',
            '• `/help` - Menampilkan menu bantuan dan panduan perintah ini.'
          ].join('\n')
        },
        {
          name: '🤖 Interaksi AI & Pengingat Cerdas',
          value: [
            '• **Mention Bot:** Tag `@Bot <pesan>` di channel mana saja untuk ngobrol atau tanya sesuatu.',
            '• **Smart Reminder:** Cukup bilang *"Ingatkan aku 30 menit lagi untuk [tugas]"*, bot akan otomatis pasang alarm dan mention kamu saat waktunya tiba!'
          ].join('\n')
        },
        {
          name: '👑 Perintah Admin (Manage Server Only)',
          value: [
            '• `/setactivity` - Mengubah Rich Presence/Aktivitas bot (Playing, Listening, Watching, Streaming, Custom).',
            '• `/setpersona` - Mengubah persona/gaya kepribadian AI bot.',
            '• `/join <channel>` - Memindahkan bot ke voice channel lain dan menjadikannya target 24/7 yang baru.',
            '• `/reconnect` - Memaksa reconnect ulang ke voice channel target saat ini.',
            '• `/leave` - Mengeluarkan bot dari voice channel dan menjeda sistem 24/7 sementara waktu.'
          ].join('\n')
        },
        {
          name: '🛡️ Fitur Otomatis 24/7',
          value: [
            '✅ **Auto-Recovery:** Otomatis masuk kembali jika bot terputus atau server Discord me-restart gateway voice.',
            '✅ **Health-Check Watchdog:** Pemantauan berkala internal untuk memastikan bot selalu standby di channel target.'
          ].join('\n')
        }
      )
      .setFooter({
        text: `24/7 Discord Voice Bot • Diminta oleh ${interaction.user.tag}`,
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
