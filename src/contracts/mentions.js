// Lets a player in Minecraft guild chat ping a guild member on Discord by typing "@<ign>".

const MAX_MENTIONS = 5;

/** The distinct IGNs written as "@name" in text (an @ inside a word, like an email address, doesn't count). */
function findMentions(text) {
  const names = new Map();
  for (const match of text.matchAll(/(?<![\w@])@(\w{1,16})(?!\w)/g)) {
    const key = match[1].toLowerCase();
    if (!names.has(key)) {
      names.set(key, match[1]);
    }
  }

  return [...names.values()].slice(0, MAX_MENTIONS);
}

const bare = (uuid) => String(uuid).replace(/-/g, "").toLowerCase();

/**
 * Discord ids of the mentioned names that are guild members with a linked Discord account.
 * @param {string[]} names
 * @param {{ getMemberUuids: () => Promise<string[]>, getUuid: (name: string) => Promise<string>, linked: Record<string, string>, onSkip?: (name: string, reason: string) => void, findDiscordId?: (uuid: string) => Promise<string | undefined>, isInServer?: (discordId: string) => Promise<boolean> }} deps
 * `findDiscordId` is the fallback for members missing from `linked`, e.g. via the Discord name set on their Hypixel profile.
 */
async function resolveMentions(names, { getMemberUuids, getUuid, linked, onSkip = () => {}, findDiscordId = async () => undefined, isInServer = async () => true }) {
  if (names.length === 0) {
    return [];
  }

  const members = new Set((await getMemberUuids()).map(bare));
  const linkedByUuid = Object.fromEntries(Object.entries(linked).map(([uuid, id]) => [bare(uuid), id]));

  const ids = new Set();
  for (const name of names) {
    let uuid;
    try {
      uuid = bare(await getUuid(name));
    } catch {
      onSkip(name, "not a valid IGN");
      continue;
    }

    if (members.has(uuid) === false) {
      onSkip(name, "not in the guild");
    } else {
      let id = linkedByUuid[uuid];
      if (id === undefined) {
        try {
          id = await findDiscordId(uuid);
        } catch {
          // treated like no match
        }
      }

      if (id === undefined) {
        onSkip(name, "has no linked Discord account");
      } else if ((await isInServer(id)) === false) {
        onSkip(name, "isn't in the Discord server");
      } else {
        ids.add(id);
      }
    }
  }

  return [...ids];
}

// Discord users whose Minecraft accounts can't ping anyone.
const BLOCKED_SENDER_IDS = ["1413588318804774975"];

const isBlockedSender = (discordId) => discordId !== undefined && BLOCKED_SENDER_IDS.includes(String(discordId));

module.exports = { findMentions, resolveMentions, isBlockedSender };
