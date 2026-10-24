const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');
const { loadPersona } = require('./persona');
const reminderManager = require('../reminders/reminderManager');

// In-memory conversation history cache: channelId -> Array of { role: 'user' | 'model', parts: [{ text: string }] }
const conversationHistories = new Map();
const MAX_HISTORY_TURNS = 10;

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().replace(/['"]/g, '') : null;
    this.modelName = (process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim().replace(/['"]/g, '');
    this.ai = null;

    if (this.apiKey) {
      try {
        this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        logger.info('Gemini', `Gemini Client initialized with model: ${this.modelName}`);
      } catch (err) {
        logger.error('Gemini', `Failed to initialize Gemini Client: ${err.message}`);
      }
    } else {
      logger.warn('Gemini', 'GEMINI_API_KEY is not defined in environment variables.');
    }
  }

  /**
   * Reinitialize with fresh API key or model name if changed.
   */
  reload() {
    this.apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().replace(/['"]/g, '') : null;
    this.modelName = (process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim().replace(/['"]/g, '');
    if (this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
      logger.info('Gemini', `Gemini Client reloaded with model: ${this.modelName}`);
    }
  }

  /**
   * Get reminder tool declaration for Gemini.
   */
  getReminderTool() {
    return {
      functionDeclarations: [
        {
          name: 'set_reminder',
          description: 'Atur pengingat/alarm/reminder untuk pengguna dengan durasi waktu (dalam menit) dari sekarang dan pesan pengingatnya.',
          parameters: {
            type: 'OBJECT',
            properties: {
              minutes_from_now: {
                type: 'NUMBER',
                description: 'Jumlah menit dari sekarang pengingat harus dikirimkan (contoh: 30 untuk 30 menit, 60 untuk 1 jam, 120 untuk 2 jam, 1440 untuk 1 hari).'
              },
              reminder_message: {
                type: 'STRING',
                description: 'Pesan, tugas, atau hal penting yang ingin diingatkan kepada pengguna.'
              }
            },
            required: ['minutes_from_now', 'reminder_message']
          }
        }
      ]
    };
  }

  /**
   * Process a chat prompt from a user.
   * @param {object} params
   * @param {string} params.prompt - User input text
   * @param {string} params.userId - User Discord ID
   * @param {string} params.userName - User Display Name
   * @param {string} params.channelId - Channel ID
   * @param {string} [params.guildId] - Guild ID
   * @returns {Promise<{ text: string, isReminder: boolean }>}
   */
  async chat({ prompt, userId, userName, channelId, guildId }) {
    if (!this.ai) {
      this.reload();
      if (!this.ai) {
        return {
          text: '⚠️ Maaf, API Key Gemini belum diatur di `.env`. Silakan masukkan `GEMINI_API_KEY` terlebih dahulu.',
          isReminder: false
        };
      }
    }

    try {
      const persona = loadPersona();
      let history = conversationHistories.get(channelId) || [];

      // Build contents with current user message
      const userMessageText = `[User: ${userName || 'Teman'}]: ${prompt}`;
      const contents = [
        ...history,
        {
          role: 'user',
          parts: [{ text: userMessageText }]
        }
      ];

      // Candidate models: primary model first, followed by reliable fallbacks
      const fallbackModels = [this.modelName, 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter(
        (m, i, arr) => Boolean(m) && arr.indexOf(m) === i
      );

      let response = null;
      let lastErr = null;

      for (const currentModel of fallbackModels) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            response = await this.ai.models.generateContent({
              model: currentModel,
              contents,
              config: {
                systemInstruction: persona.systemInstruction,
                tools: [{ functionDeclarations: this.getReminderTool().functionDeclarations }]
              }
            });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            const cause = err.cause?.code || err.cause?.message || '';
            logger.warn(
              'Gemini',
              `Model ${currentModel} attempt ${attempt} failed: ${err.message} ${cause ? `[Cause: ${cause}]` : ''}`
            );

            // If model is not found, don't retry same model
            if (err.message.includes('404') || err.message.includes('NOT_FOUND')) {
              break;
            }

            if (attempt < 2) {
              await new Promise(res => setTimeout(res, 1200));
            }
          }
        }
        if (response) break;
      }

      if (!response && lastErr) {
        throw lastErr;
      }

      // Check if model called the set_reminder function
      if (response.functionCalls && response.functionCalls.length > 0) {
        const fnCall = response.functionCalls[0];
        if (fnCall.name === 'set_reminder') {
          const args = fnCall.args;
          const minutes = Math.max(1, Math.round(Number(args.minutes_from_now) || 1));
          const message = args.reminder_message || 'Pengingat tanpa judul';
          const dueTimestamp = Date.now() + minutes * 60 * 1000;

          // Save reminder
          reminderManager.addReminder({
            userId,
            channelId,
            guildId,
            message,
            dueTimestamp
          });

          // Time formatting
          const dateStr = new Date(dueTimestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
          });

          const replyText = `⏰ Siap! Aku sudah jadwalkan pengingat untuk kamu:\n> **"${message}"**\n📅 Sekitar **${minutes} menit** lagi (pukul **${dateStr} WIB**). Nanti aku mention langsung di channel ini ya! ✨💖`;

          // Record in conversation history
          history.push({ role: 'user', parts: [{ text: userMessageText }] });
          history.push({ role: 'model', parts: [{ text: replyText }] });
          if (history.length > MAX_HISTORY_TURNS * 2) {
            history = history.slice(-MAX_HISTORY_TURNS * 2);
          }
          conversationHistories.set(channelId, history);

          return { text: replyText, isReminder: true };
        }
      }

      // Standard text response
      const replyText = response.text || 'Maaf, aku tidak dapat memproses jawaban saat ini.';

      // Save to history
      history.push({ role: 'user', parts: [{ text: userMessageText }] });
      history.push({ role: 'model', parts: [{ text: replyText }] });
      if (history.length > MAX_HISTORY_TURNS * 2) {
        history = history.slice(-MAX_HISTORY_TURNS * 2);
      }
      conversationHistories.set(channelId, history);

      return { text: replyText, isReminder: false };
    } catch (err) {
      let errorMsg = err.message || 'Unknown error';
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.error?.message) {
          errorMsg = parsed.error.message;
        }
      } catch {}

      const cause = err.cause?.code || err.cause?.message || '';
      logger.error('Gemini', `Chat error: ${errorMsg} ${cause ? `[Cause: ${cause}]` : ''}`, err);
      return {
        text: `⚠️ Maaf, terjadi kendala koneksi ke Gemini AI (${errorMsg}${cause ? `: ${cause}` : ''}). Coba kirim ulang pesanmu ya!`,
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

const geminiService = new GeminiService();
module.exports = geminiService;
