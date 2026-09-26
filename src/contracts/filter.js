const config = require("../../config.json");
const Filter = require("bad-words");

const filter = new Filter();
filter.addWords(...(config.discord.other.filterWords ?? []));

/**
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
  if (!config.discord.other.filterMessages || typeof text !== "string" || text.length === 0) {
    return text;
  }

  try {
    return filter.clean(text);
  } catch (error) {
    return text;
  }
}

module.exports = { cleanText };
