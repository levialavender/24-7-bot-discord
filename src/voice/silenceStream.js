const { Readable } = require('stream');

/**
 * Opus silence packet (3 bytes: [0xF8, 0xFF, 0xFE]).
 * Standard Opus silence frame representing 20ms of audio at 48kHz.
 */
const OPUS_SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);

/**
 * Creates a continuous readable stream emitting Opus silence frames every 20ms.
 * This keeps the UDP gateway alive and prevents Discord inactivity timeouts
 * without consuming perceptible CPU or bandwidth.
 */
class SilenceStream extends Readable {
  constructor(options = {}) {
    super(options);
    this.interval = null;
  }

  _read() {
    if (!this.interval) {
      this.interval = setInterval(() => {
        if (!this.push(OPUS_SILENCE_FRAME)) {
          clearInterval(this.interval);
          this.interval = null;
        }
      }, 20);
    }
  }

  _destroy(err, callback) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    callback(err);
  }
}

module.exports = {
  SilenceStream,
  OPUS_SILENCE_FRAME
};
