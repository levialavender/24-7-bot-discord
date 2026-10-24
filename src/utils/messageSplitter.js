/**
 * Splits a long message into chunks under maxLength (default 1950 chars to be safe)
 * splitting by newlines or paragraphs when possible.
 * @param {string} text
 * @param {number} [maxLength=1950]
 * @returns {string[]}
 */
function splitMessage(text, maxLength = 1950) {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try finding the last newline before maxLength
    let splitIndex = remaining.lastIndexOf('\n', maxLength);

    // If no newline found, look for last space
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }

    // If neither exists, force cut
    if (splitIndex <= 0) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

module.exports = { splitMessage };
