const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '../../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Default initial configuration
const defaultSettings = {
  activity: {
    type: 'Listening',
    name: '24/7 Voice Channel | /help',
    status: 'online',
    url: null
  },
  customChannelId: null
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    logger.error('Settings', `Failed to create data directory: ${err.message}`);
  }
}

/**
 * Load settings from JSON file.
 * @returns {typeof defaultSettings}
 */
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (err) {
    logger.error('Settings', `Failed to read settings file: ${err.message}`);
  }
  return { ...defaultSettings };
}

/**
 * Save settings to JSON file.
 * @param {Object} newSettings
 */
function saveSettings(newSettings) {
  try {
    const current = loadSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    logger.error('Settings', `Failed to save settings file: ${err.message}`);
    return null;
  }
}

module.exports = {
  loadSettings,
  saveSettings
};
