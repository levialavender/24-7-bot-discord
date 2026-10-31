# 🎙️ Discord 24/7 Voice Bot & Rich Presence Manager

Bot Discord Voice 24/7 tangguh dan siap pakai untuk production, dibangun menggunakan **Node.js**, **Discord.js v14+**, dan **@discordjs/voice**. Bot ini dirancang agar selalu online dan standby di voice channel tanpa terputus, dilengkapi mekanisme auto-reconnect canggih, watchdog health-check, transmisi silence stream pencegah timeout, metrik status sistem VPS, serta fitur **Rich Presence dinamis** yang bisa diatur oleh Admin melalui Slash Command.

---

## 🌟 Fitur Utama

- **Stay 24/7 di Voice Channel & Watchdog Mandiri:**
  - Otomatis bergabung ke voice channel target saat bot dinyalakan.
  - Memantau lifecycle state `@discordjs/voice` (`Ready`, `Connecting`, `Signalling`, `Disconnected`, `Destroyed`).
  - Mampu membedakan perpindahan server voice Discord otomatis (*server migration*) dengan disconnect sebenarnya.
  - **Loop Health-Check Watchdog (setiap 30 detik):** Memastikan bot benar-benar ada di dalam voice channel. Jika bot di-kick atau terputus secara tidak wajar, watchdog akan mendeteksi dan langsung menghubungkan ulang.
  - **Exponential Backoff dengan Jitter:** Menghindari rate-limit gateway Discord saat proses koneksi ulang.
  - **Silence Keep-Alive (Paket Opus Hening):** Mengirimkan frame Opus silence 20ms (`Buffer.from([0xF8, 0xFF, 0xFE])`) tanpa suara ke gateway Discord. Mencegah Discord RTC memutuskan koneksi karena dianggap tidak aktif (*inactivity timeout*), tanpa membebani CPU.

- **🎭 Rich Presence / Aktivitas Bot Dinamis (`/setactivity`):**
  - Admin dapat mengubah aktivitas bot kapan saja langsung dari Discord!
  - Pilihan tipe aktivitas: **🎧 Listening**, **🎮 Playing**, **📺 Watching**, **🏆 Competing**, **🟣 Streaming** (dengan URL Twitch/YouTube), dan **💬 Custom Status**.
  - Pilihan status online: **🟢 Online**, **🟡 Idle (AFK)**, **🔴 Do Not Disturb (DND)**, dan **⚪ Invisible**.
  - **Penyimpanan Permanen:** Pengaturan aktivitas disimpan ke file `data/settings.json`, sehingga saat bot di-restart (misalnya lewat PM2), status aktivitas kustom tetap tersimpan!

- **🕹️ Kontrol Voice Fleksibel:**
  - `/join <channel>`: Memindahkan bot ke voice channel lain dan menjadikannya channel default baru.
  - `/reconnect`: Memaksa reconnect ulang ke voice channel target secara instan.
  - `/leave`: Mengeluarkan bot dan menjeda auto-reconnect 24/7 sementara waktu.

- **📊 Diagnostik Lengkap & Metrik VPS (`/status`):**
  - **Uptime:** Durasi bot aktif & uptime VPS/Server (`Xd Xh Xm Xs`).
  - **Status Voice:** Status gateway, nama & ID channel, durasi voice stay, dan status streaming hening.
  - **Latensi:** WebSocket gateway ping, REST API round-trip latency, dan voice UDP ping.
  - **Resource Hardware:** Beban CPU (%), jumlah core CPU, RAM terpakai / total, pemakaian memori RSS bot, dan info OS VPS.

- **🤖 AI Chatbot Cerdas :**
  - **Tanya Apa Saja:** Cukup mention `@Bot <pertanyaan>` di channel mana saja atau gunakan perintah `/ask <prompt>`.
  - **Memory Percakapan:** Bot mengingat konteks obrolan sebelumnya per channel sehingga percakapan terasa hidup dan nyambung.
  - **Dedicated AI Channel (Opsional):** Jika `AI_CHANNEL_ID` diisi di `.env`, semua pesan di channel tersebut otomatis dijawab AI tanpa perlu tag/mention.

- **⏰ Smart Reminder (Pengingat Otomatis via Natural Language):**
  - **Chat Alami:** Cukup katakan ke bot: *"Ingatkan aku 30 menit lagi untuk makan siang"* atau *"2 jam lagi ingetin angkat jemuran"*.
  - AI otomatis memproses waktu dan pesan dengan **Function Calling (`set_reminder`) via 9Router**.
  - Saat waktunya tiba, bot otomatis me-mention kamu di channel: `⏰ @User Pengingat: [pesan]`.
  - **Penyimpanan Persisten:** Jadwal tersimpan aman di `data/reminders.json`, tidak akan hilang meskipun bot atau VPS direstart.
  - Perintah `/reminders list`, `/reminders cancel <id>`, dan `/reminders clear` untuk mengelola jadwal aktif.

- **🎭 Persona & Karakter AI Kustom (`/setpersona`):**
  - Gaya bahasa awal: asisten hangat, manis, ramah, dan perhatian untuk server sepasang kekasih.
  - Admin/Owner bisa melihat atau mengubah instruksi kepribadian kapan saja lewat perintah `/setpersona` tanpa menyentuh kode.

- **🛡️ Anti-Crash & Auto-Restart:**
  - Penanganan error global (`uncaughtException`, `unhandledRejection`, `warning`) agar proses bot tidak mati mendadak saat terjadi error jaringan.
  - Konfigurasi **PM2** (`ecosystem.config.js`) siap pakai dengan auto-restart, batas memori, dan logging otomatis.

---

## 📁 Struktur Direktori

```text
discord-voice-bot/
├── ecosystem.config.js       # Konfigurasi PM2 untuk hosting VPS
├── package.json              # Dependensi npm & script eksekusi
├── .env.example              # Template variabel lingkungan (.env)
├── .gitignore                # Berkas yang diabaikan git
├── index.js                  # Entry point utama (mengarahkan ke src/index.js)
├── deploy-commands.js        # Helper registrasi slash commands
├── data/
│   ├── settings.json         # Penyimpanan pengaturan persisten (Rich Presence & Channel)
│   ├── persona.json          # Instruksi persona/kepribadian AI
│   └── reminders.json        # Database pengingat aktif (auto-reload saat restart)
├── src/
│   ├── index.js              # Inisialisasi client, event listener & anti-crash
│   ├── deploy-commands.js    # Script deploy slash commands ke Discord REST API
│   ├── ai/
│   │   ├── routerClient.js   # Integrasi 9Router (OpenAI-compatible) & Function Calling
│   │   └── persona.js        # Pengelola prompt kepribadian AI
│   ├── reminders/
│   │   └── reminderManager.js# Pengelola timer pengingat & auto-mention
│   ├── commands/
│   │   ├── ask.js            # /ask - Tanya AI (9Router)
│   │   ├── help.js           # /help - Menu panduan bot
│   │   ├── join.js           # /join - Pindah channel voice (Admin)
│   │   ├── leave.js          # /leave - Keluar dari voice channel (Admin)
│   │   ├── reconnect.js      # /reconnect - Paksa koneksi ulang (Admin)
│   │   ├── reminders.js      # /reminders - Kelola pengingat aktif (list/cancel/clear)
│   │   ├── setactivity.js    # /setactivity - Ubah Rich Presence bot (Admin)
│   │   ├── setpersona.js     # /setpersona - Ubah kepribadian AI bot (Admin)
│   │   └── status.js         # /status - Diagnostik bot & resource VPS
│   ├── voice/
│   │   ├── silenceStream.js  # Generator paket hening Opus 20ms
│   │   └── voiceManager.js   # Pengelola koneksi 24/7, lifecycle & watchdog
│   └── utils/
│       ├── logger.js         # Logger berwarna dengan stempel waktu
│       ├── messageSplitter.js# Pemecah pesan teks panjang (<2000 karakter)
│       ├── settings.js       # Helper baca/tulis pengaturan persisten
│       └── systemMetrics.js  # Pengambil metrik CPU, RAM, Uptime & OS
└── README.md                 # Dokumentasi panduan lengkap
```

---

## ⚙️ Persyaratan Sistem

1. **Node.js**: Versi `18.0.0` atau yang lebih baru (disarankan Node.js LTS v20 atau v22). Periksa dengan perintah:
   ```bash
   node -v
   ```
2. **Akun & Aplikasi Bot Discord** dari [Discord Developer Portal](https://discord.com/developers/applications).
3. **PM2** (opsional, sangat disarankan untuk VPS agar bot menyala terus di latar belakang):
   ```bash
   npm install -g pm2
   ```

---

## 🚀 Langkah Instalasi & Menjalankan Bot

### 1. Salin / Buka Folder Proyek
Buka terminal dan masuk ke folder proyek:
```bash
cd "discord voice bot"
```

### 2. Instal Dependensi
```bash
npm install
```

> **Catatan Dependensi:** Proyek ini menggunakan `opusscript` dan `tweetnacl` murni berbasis JavaScript, sehingga tidak memerlukan kompilasi C++ Visual Studio atau node-gyp native build tools. Instalasi berjalan cepat dan kompatibel di Windows, Linux (Ubuntu/Debian/CentOS), maupun macOS.

---

### 3. Konfigurasi Variabel Lingkungan (`.env`)

Salin file `.env.example` menjadi `.env`:
```bash
# Windows PowerShell
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Buka file `.env` dan lengkapi datanya:

```ini
# Kredensial Bot Discord
DISCORD_TOKEN=MTE5...token_bot_kamu_di_sini
CLIENT_ID=1198...application_client_id_kamu
GUILD_ID=123456789012345678
CHANNEL_ID=987654321098765432

# Pengaturan Voice Bot (Opsional / Default sudah optimal)
ENABLE_SILENCE_STREAM=false
HEALTH_CHECK_INTERVAL_MS=30000
MAX_RECONNECT_DELAY_MS=60000
SELF_DEAF=true
SELF_MUTE=false

```

#### Cara Mendapatkan ID di Discord:
1. Di aplikasi Discord, buka **User Settings** -> **Advanced** -> Aktifkan **Developer Mode**.
2. **`CLIENT_ID`**: Buka Discord Developer Portal -> Pilih Aplikasi kamu -> **General Information** -> Salin **Application ID**.
3. **`GUILD_ID`**: Klik kanan ikon server Discord kamu -> Klik **Copy Server ID**.
4. **`CHANNEL_ID`**: Klik kanan pada Voice Channel tujuan -> Klik **Copy Channel ID**.

---

### 4. Hak Izin Bot di Discord Developer Portal

1. Buka [Discord Developer Portal](https://discord.com/developers/applications) -> Pilih Bot kamu.
2. Buka tab **Bot**:
   - Di bagian **Privileged Gateway Intents**, centang:
     - **SERVER MEMBERS INTENT**
     - **MESSAGE CONTENT INTENT** *(Wajib agar bot bisa membaca pesan dan merespons saat di-mention)*.
3. Buka tab **OAuth2** -> **URL Generator**:
   - **Scopes**: Centang `bot` dan `applications.commands`.
   - **Bot Permissions**:
     - `Connect` (Menghubungkan ke Voice)
     - `Speak` (Berbicara / Mengirim stream suara)
     - `View Channel` (Melihat channel)
     - `Send Messages` (Mengirim pesan teks)
     - `Embed Links` (Menampilkan embed warna)
     - `Use Slash Commands` (Menggunakan slash commands)
4. Salin tautan invite yang dihasilkan, buka di browser, dan masukkan bot ke server kamu.

---

### 5. Deploy / Daftarkan Slash Commands

Jalankan perintah ini sekali untuk mendaftarkan slash commands ke server Discord:

```bash
npm run deploy-commands
```

Output yang berhasil:
```text
[DeployCommands] Started refreshing 6 application (/) commands.
[DeployCommands] Registering commands for Guild ID: 123456789012345678
[DeployCommands] Successfully reloaded 6 guild application (/) commands.
```

---

### 6. Menjalankan Bot

#### A. Mode Uji Coba / Development
```bash
npm start
# atau dengan hot-reload otomatis saat file diedit:
npm run dev
```

#### B. Mode Production di VPS Menggunakan PM2 (Sangat Disarankan)

PM2 memastikan bot berjalan 24/7 di latar belakang, otomatis menyala kembali jika crash, dan otomatis hidup saat VPS reboot.

```bash
# Menjalankan bot dengan PM2
pm2 start ecosystem.config.js

# Melihat log bot secara real-time
pm2 logs discord-24-7-voice-bot

# Melihat status pemakaian RAM & CPU bot
pm2 status

# Restart bot
pm2 restart discord-24-7-voice-bot

# Menghentikan bot
pm2 stop discord-24-7-voice-bot

# Mengatur agar PM2 otomatis menyala saat VPS reboot
pm2 save
pm2 startup
```

---

## 📜 Daftar Slash Commands

| Perintah | Hak Akses | Deskripsi |
| :--- | :--- | :--- |
| **`/ask`** | Semua Member | Tanya apa saja ke AI (9Router AI). |
| **`/reminders`** | Semua Member | Kelola jadwal pengingat aktif milikmu (`list`, `cancel`, `clear`). |
| **`/status`** | Semua Member | Menampilkan status voice bot, latensi API/WS, uptime, dan pemakaian CPU & RAM pada VPS. |
| **`/help`** | Semua Member | Menampilkan menu bantuan dan daftar seluruh perintah yang tersedia. |
| **`/setpersona`** | **Manage Server** | Melihat atau mengubah instruksi persona/kepribadian bot AI secara fleksibel. |
| **`/setactivity`** | **Manage Server** | Mengubah aktivitas Rich Presence bot (Playing, Listening, Watching, Streaming, Custom) dan status (Online, Idle, DND, Invisible). |
| **`/join`** | **Manage Server** | Memindahkan bot ke voice channel lain dan menyimpannya sebagai target 24/7 baru. |
| **`/reconnect`** | **Manage Server** | Memaksa bot melakukan reset dan koneksi ulang ke voice channel secara instan. |
| **`/leave`** | **Manage Server** | Mengeluarkan bot dari voice channel dan menjeda proteksi auto-reconnect 24/7. |

---

### 💡 Contoh Penggunaan Perintah `/setactivity`

1. **Membuat bot tampak sedang mendengarkan musik:**
   ```text
   /setactivity name:Lofi Beats 24/7 type:Listening (Mendengarkan) status:Online
   ```
2. **Membuat bot live streaming Twitch:**
   ```text
   /setactivity name:Radio 24/7 type:Streaming status:Online stream_url:https://twitch.tv/discord
   ```
3. **Membuat status kustom unik:**
   ```text
   /setactivity name:Standby di Voice Channel status:Idle (AFK)
   ```

*Semua pengaturan Rich Presence otomatis tersimpan ke `data/settings.json`, sehingga status tidak akan hilang meskipun bot direstart.*

---

## 🛠️ Tanya Jawab & Solusi Kendala (FAQ)

- **Q: Kenapa bot tidak bersuara?**
  - **A:** Bot ini dirancang sebagai **24/7 Voice Channel Stay Bot** (penjaga voice channel). Bot mengirimkan paket *Opus silence* (keheningan) untuk menjaga koneksi UDP gateway tetap aktif tanpa mengganggu orang yang sedang mengobrol di channel.
- **Q: Apakah bot akan keluar jika semua orang meninggalkan voice channel?**
  - **A:** Tidak! Dengan fitur 24/7 dan watchdog loop, bot akan tetap berada di dalam channel sendirian tanpa batas waktu.
- **Q: Apa yang terjadi jika bot di-kick atau di-disconnect oleh admin?**
  - **A:** Watchdog loop (berjalan setiap 30 detik) akan mendeteksi bahwa bot tidak lagi berada di voice channel target dan akan otomatis masuk kembali. Jika ingin bot keluar permanen, gunakan perintah `/leave`.
