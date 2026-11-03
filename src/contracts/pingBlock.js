// Discord users who have turned off being pinged by "@<ign>" mentions from Minecraft guild chat.

const { existsSync, readFileSync, writeFileSync } = require("fs");

const FILE = "data/pingBlocked.json";

function load() {
  if (existsSync(FILE) === false) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(FILE).toString()).map(String);
  } catch {
    return [];
  }
}

const isPingBlocked = (discordId) => load().includes(String(discordId));

/** Flips whether discordId is blocked and returns the new state (true = blocked). */
function togglePingBlock(discordId) {
  const id = String(discordId);
  const blocked = load();
  const index = blocked.indexOf(id);

  if (index === -1) {
    blocked.push(id);
  } else {
    blocked.splice(index, 1);
  }

  writeFileSync(FILE, JSON.stringify(blocked, null, 2));
  return index === -1;
}

module.exports = { isPingBlocked, togglePingBlock };
