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
 * @param {{ getMemberUuids: () => Promise<string[]>, getUuid: (name: string) => Promise<string>, linked: Record<string, string>, onSkip?: (name: string, reason: string) => void }} deps
 */
async function resolveMentions(names, { getMemberUuids, getUuid, linked, onSkip = () => {} }) {
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
    } else if (linkedByUuid[uuid] === undefined) {
      onSkip(name, "has no linked Discord account");
    } else {
      ids.add(linkedByUuid[uuid]);
    }
  }

  return [...ids];
}

module.exports = { findMentions, resolveMentions };
