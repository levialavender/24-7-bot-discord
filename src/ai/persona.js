const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PERSONA_FILE = path.join(DATA_DIR, 'persona.json');

const DEFAULT_PERSONA = {
  name: 'Couple Assistant AI',
  systemInstruction: `Kamu adalah asisten bot pribadi yang ramah, hangat, manis, santai, dan penuh perhatian di server Discord untuk sepasang kekasih.

Karakter & Gaya Bicara:
- Gunakan bahasa Indonesia santai yang akrab, hangat, suportif, dan menyenangkan (panggil dengan sebutan ramah atau santai, gunakan emotikon manis seperti ✨, 💖, 🌸, ⏰, 😸).
- Siap menjawab segala pertanyaan mulai dari hal umum, rekomendasi makanan, hiburan, ide kencan, pekerjaan, curhat ringan, hingga tugas harian.
- Jika pengguna meminta untuk diingatkan sesuatu (misal: "ingatkan aku...", "ingetin nanti..."), gunakan tool 'set_reminder' untuk mengatur waktu pengingat secara tepat.
- Jangan bersikap kaku seperti robot atau customer service korporat. Jadilah asisten pribadi kesayangan yang seru dan helpful!
- Jawaban jelas, ringkas, dan to the point tanpa bertele-tele kecuali jika diminta penjelasan mendalam.`
};

/**
 * Ensures data directory and persona file exist.
 */
function ensurePersonaFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(PERSONA_FILE)) {
    fs.writeFileSync(PERSONA_FILE, JSON.stringify(DEFAULT_PERSONA, null, 2), 'utf-8');
    logger.info('Persona', 'Initialized default persona.json');
  }
}

/**
 * Loads current persona configuration.
 * @returns {object} Persona object with systemInstruction
 */
function loadPersona() {
  try {
    ensurePersonaFile();
    const raw = fs.readFileSync(PERSONA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('Persona', `Failed to load persona.json, using default: ${err.message}`);
    return DEFAULT_PERSONA;
  }
}

/**
 * Saves new persona / system instruction.
 * @param {string} systemInstruction
 * @param {string} [name]
 */
function savePersona(systemInstruction, name) {
  try {
    ensurePersonaFile();
    const current = loadPersona();
    const updated = {
      ...current,
      systemInstruction: systemInstruction.trim(),
      ...(name ? { name: name.trim() } : {}),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(PERSONA_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    logger.info('Persona', 'Persona successfully updated.');
    return updated;
  } catch (err) {
    logger.error('Persona', `Failed to save persona: ${err.message}`);
    throw err;
  }
}

module.exports = {
  loadPersona,
  savePersona,
  DEFAULT_PERSONA
};
