const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');

class ReminderManager {
  constructor() {
    this.client = null;
    this.reminders = [];
    this.intervalId = null;
    this.isProcessing = false;
  }

  /**
   * Ensure directory and reminders file exist.
   */
  ensureFile() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(REMINDERS_FILE)) {
      fs.writeFileSync(REMINDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  /**
   * Load reminders from JSON file.
   */
  load() {
    try {
      this.ensureFile();
      const raw = fs.readFileSync(REMINDERS_FILE, 'utf-8');
      this.reminders = JSON.parse(raw);
      if (!Array.isArray(this.reminders)) this.reminders = [];
    } catch (err) {
      logger.error('ReminderManager', `Failed to load reminders: ${err.message}`);
      this.reminders = [];
    }
  }

  /**
   * Save reminders to JSON file.
   */
  save() {
    try {
      this.ensureFile();
      fs.writeFileSync(REMINDERS_FILE, JSON.stringify(this.reminders, null, 2), 'utf-8');
    } catch (err) {
      logger.error('ReminderManager', `Failed to save reminders: ${err.message}`);
    }
  }

  /**
   * Start checking for due reminders every 5 seconds.
   * @param {import('discord.js').Client} client
   */
  start(client) {
    this.client = client;
    this.load();
    logger.info('ReminderManager', `Initialized with ${this.reminders.length} active reminder(s).`);

    // Run check every 5 seconds
    this.intervalId = setInterval(() => this.checkDueReminders(), 5000);
  }

  /**
   * Stop background reminder loop.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Add a new reminder.
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.channelId
   * @param {string} [params.guildId]
   * @param {string} params.message
   * @param {number} params.dueTimestamp (Unix timestamp in ms)
   * @returns {object} created reminder
   */
  addReminder({ userId, channelId, guildId, message, dueTimestamp }) {
    const id = `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newReminder = {
      id,
      userId,
      channelId,
      guildId: guildId || null,
      message,
      dueTimestamp,
      createdAt: Date.now()
    };

    this.reminders.push(newReminder);
    // Sort reminders chronologically
    this.reminders.sort((a, b) => a.dueTimestamp - b.dueTimestamp);
    this.save();

    logger.info(
      'ReminderManager',
      `Reminder created for User <@${userId}>: "${message}" at ${new Date(dueTimestamp).toLocaleString('id-ID')}`
    );
    return newReminder;
  }

  /**
   * List reminders for a specific user.
   * @param {string} userId
   * @returns {Array}
   */
  listUserReminders(userId) {
    return this.reminders.filter(r => r.userId === userId);
  }

  /**
   * Delete a reminder by ID for a user.
   * @param {string} id
   * @param {string} userId
   * @returns {boolean}
   */
  deleteReminder(id, userId) {
    const initialLen = this.reminders.length;
    this.reminders = this.reminders.filter(r => !(r.id === id && (r.userId === userId || !userId)));
    if (this.reminders.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Check and fire due reminders.
   */
  async checkDueReminders() {
    if (this.isProcessing || !this.client || this.reminders.length === 0) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      const due = [];
      const remaining = [];

      for (const rem of this.reminders) {
        if (rem.dueTimestamp <= now) {
          due.push(rem);
        } else {
          remaining.push(rem);
        }
      }

      if (due.length > 0) {
        this.reminders = remaining;
        this.save();

        for (const rem of due) {
          try {
            const channel = await this.client.channels.fetch(rem.channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
              await channel.send({
                content: `⏰ <@${rem.userId}> **Pengingat:**\n${rem.message}`,
                allowedMentions: { users: [rem.userId] }
              });
              logger.info('ReminderManager', `Delivered reminder to <@${rem.userId}> in #${channel.name || rem.channelId}`);
            } else {
              logger.warn('ReminderManager', `Could not find text channel ${rem.channelId} for reminder ${rem.id}`);
            }
          } catch (err) {
            logger.error('ReminderManager', `Error sending reminder ${rem.id}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.error('ReminderManager', `Check due loop error: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}

const reminderManager = new ReminderManager();
module.exports = reminderManager;
