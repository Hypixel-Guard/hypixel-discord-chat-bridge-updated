// Discord users who are blocked from using "!" Minecraft commands. Minecraft players are matched
// to Discord ids through data/linked.json (uuid -> discord id).

const { existsSync, readFileSync, writeFileSync } = require("fs");

const FILE = "data/commandBlacklist.json";
const DEFAULT_BLACKLIST = ["754951801899450428"];

function load() {
  if (existsSync(FILE) === false) {
    writeFileSync(FILE, JSON.stringify(DEFAULT_BLACKLIST, null, 2));
    return [...DEFAULT_BLACKLIST];
  }

  try {
    return JSON.parse(readFileSync(FILE).toString()).map(String);
  } catch {
    return [...DEFAULT_BLACKLIST];
  }
}

const getBlacklist = () => load();
const isBlacklisted = (discordId) => load().includes(String(discordId));

/** Returns true if the user was added, false if already present. */
function addToBlacklist(discordId) {
  const id = String(discordId);
  const list = load();
  if (list.includes(id)) return false;
  list.push(id);
  writeFileSync(FILE, JSON.stringify(list, null, 2));
  return true;
}

/** Returns true if the user was removed, false if not present. */
function removeFromBlacklist(discordId) {
  const id = String(discordId);
  const list = load();
  if (list.includes(id) === false) return false;
  writeFileSync(FILE, JSON.stringify(list.filter((entry) => entry !== id), null, 2));
  return true;
}

/** Whether the Minecraft player (by IGN) is linked to a blacklisted Discord user. */
async function isPlayerBlacklisted(username) {
  const list = load();
  if (list.length === 0) return false;

  try {
    const { getUUID } = require("./API/mowojangAPI.js");
    const uuid = String(await getUUID(username)).replace(/-/g, "").toLowerCase();
    const linked = JSON.parse(readFileSync("data/linked.json").toString());
    for (const [linkedUuid, id] of Object.entries(linked)) {
      if (linkedUuid.replace(/-/g, "").toLowerCase() === uuid) {
        return list.includes(String(id));
      }
    }
  } catch {
    // Unresolvable names / missing link data: not blacklisted.
  }
  return false;
}

module.exports = { getBlacklist, isBlacklisted, addToBlacklist, removeFromBlacklist, isPlayerBlacklisted };
