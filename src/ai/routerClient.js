const { loadPersona } = require('./persona');
const reminderManager = require('../reminders/reminderManager');
const logger = require('../utils/logger');

const MAX_HISTORY_TURNS = 10;
// Memory cache for active channels
const conversationHistories = new Map();

class RouterAIService {
  constructor() {
    this.reload();
  }

  /**
   * Reload configuration from environment variables.
   */
  reload() {
    let baseUrl = (process.env.ROUTER_BASE_URL || process.env.AI_BASE_URL || 'http://localhost:20128/v1').trim();
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = (process.env.ROUTER_API_KEY || process.env.AI_API_KEY || '9router-local').trim().replace(/['"]/g, '');
    this.modelName = (process.env.ROUTER_MODEL || process.env.AI_MODEL || 'claude-3-5-sonnet').trim().replace(/['"]/g, '');

    logger.info('9Router', `Initialized 9Router Client. BaseURL: ${this.baseUrl}, Model: ${this.modelName}`);
  }

  /**
   * Return standard OpenAI function tool declaration for setting reminders.
   */
  getReminderTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'set_reminder',
          description: 'Jadwalkan pesan pengingat (reminder) otomatis di Discord untuk waktu tertentu di masa depan.',
          parameters: {
            type: 'object',
            properties: {
              minutes_from_now: {
                type: 'integer',
                description: 'Jumlah menit dari sekarang saat pengingat harus dibunyikan.'
              },
              reminder_message: {
                type: 'string',
                description: 'Isi pesan pengingat yang ingin disampaikan.'
              }
            },
            required: ['minutes_from_now', 'reminder_message']
          }
        }
      }
    ];
  }

  /**
   * Sends user query to 9Router OpenAI-compatible API.
   * @param {Object} params
   * @param {string} params.userMessageText
   * @param {string} params.channelId
   * @param {string} params.userId
   * @param {string} params.guildId
   * @param {string} [params.username]
   * @returns {Promise<{ text: string, isReminder: boolean }>}
   */
  async chat({ userMessageText, prompt, channelId, userId, guildId, username, userName }) {
    try {
      const messageText = userMessageText || prompt || '';
      const userDisplayName = username || userName || 'Pengguna';
      const persona = loadPersona();

      // Retrieve or init channel conversation history
      let history = conversationHistories.get(channelId) || [];

      // Format payload with system instruction and history
      const messages = [
        {
          role: 'system',
          content: `${persona.systemInstruction}\n\nPengguna saat ini di Discord: ${userDisplayName} (ID: ${userId}). Waktu saat ini: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.`
        },
        ...history,
        {
          role: 'user',
          content: messageText
        }
      ];

      const endpoint = `${this.baseUrl}/chat/completions`;
      const requestBody = {
        model: this.modelName,
        messages,
        tools: this.getReminderTools(),
        temperature: 0.7
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`9Router API returned status ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice || !choice.message) {
        throw new Error('Format response dari 9Router tidak sesuai / kosong.');
      }

      const message = choice.message;

      // Check if model called set_reminder function
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls.find(t => t.function?.name === 'set_reminder') || message.tool_calls[0];
        if (toolCall.function?.name === 'set_reminder') {
          let args = {};
          try {
            args = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
          } catch (e) {
            args = {};
          }

          const minutes = Math.max(1, Math.round(Number(args.minutes_from_now) || 1));
          const reminderMsg = args.reminder_message || 'Pengingat tanpa judul';
          const dueTimestamp = Date.now() + minutes * 60 * 1000;

          // Save reminder
          reminderManager.addReminder({
            userId,
            channelId,
            guildId,
            message: reminderMsg,
            dueTimestamp
          });

          // Format WIB time
          const dateStr = new Date(dueTimestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
          });

          const replyText = `⏰ Siap! Aku sudah jadwalkan pengingat untuk kamu:\n> **"${reminderMsg}"**\n📅 Sekitar **${minutes} menit** lagi (pukul **${dateStr} WIB**). Nanti aku mention langsung di channel ini ya! ✨💖`;

          // Record in conversation history
          history.push({ role: 'user', content: messageText });
          history.push({ role: 'assistant', content: replyText });
          if (history.length > MAX_HISTORY_TURNS * 2) {
            history = history.slice(-MAX_HISTORY_TURNS * 2);
          }
          conversationHistories.set(channelId, history);

          return { text: replyText, isReminder: true };
        }
      }

      // Standard text response
      const replyText = message.content || 'Maaf, aku tidak menerima respon teks dari model.';

      // Save to history
      history.push({ role: 'user', content: messageText });
      history.push({ role: 'assistant', content: replyText });
      if (history.length > MAX_HISTORY_TURNS * 2) {
        history = history.slice(-MAX_HISTORY_TURNS * 2);
      }
      conversationHistories.set(channelId, history);

      return { text: replyText, isReminder: false };
    } catch (err) {
      logger.error('9Router', `Chat error: ${err.message}`, err);

      let hint = '';
      if (err.message.includes('ECONNREFUSED')) {
        hint = `\n💡 *Pastikan 9Router sudah berjalan di \`${this.baseUrl}\`.*`;
      }

      return {
        text: `⚠️ Maaf, terjadi kendala koneksi ke AI 9Router (${err.message}).${hint} Coba cek kembali ya!`,
        isReminder: false
      };
    }
  }

  /**
   * Clear conversation history for a channel.
   * @param {string} channelId
   */
  clearHistory(channelId) {
    conversationHistories.delete(channelId);
  }
}

const routerAIService = new RouterAIService();
module.exports = routerAIService;
