// Discord users whose messages are no longer bridged to Hypixel guild chat.

const { existsSync, readFileSync, writeFileSync } = require("fs");

const FILE = "data/chatBlacklist.json";

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

const getChatBlacklist = () => load();
const isChatBlacklisted = (discordId) => load().includes(String(discordId));

/** Returns true if the user was added, false if already present. */
function addToChatBlacklist(discordId) {
  const id = String(discordId);
  const list = load();
  if (list.includes(id)) return false;
  list.push(id);
  writeFileSync(FILE, JSON.stringify(list, null, 2));
  return true;
}

/** Returns true if the user was removed, false if not present. */
function removeFromChatBlacklist(discordId) {
  const id = String(discordId);
  const list = load();
  if (list.includes(id) === false) return false;
  writeFileSync(FILE, JSON.stringify(list.filter((entry) => entry !== id), null, 2));
  return true;
}

module.exports = { getChatBlacklist, isChatBlacklisted, addToChatBlacklist, removeFromChatBlacklist };
