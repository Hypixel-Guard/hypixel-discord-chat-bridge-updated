// @ts-ignore
const { get } = require("axios");

const uuidCache = new Map();
const usernameCache = new Map();

/**
 * Looks up a player on Mowojang (a caching Mojang proxy) and falls back to
 * Mojang directly if it's down. Mojang rate-limits per IP quite aggressively,
 * so going through the proxy first keeps the bot from hitting 429s.
 * @param {string} query username or uuid
 * @param {"username" | "uuid"} type what is being looked up, for error messages
 * @returns {Promise<{ id: string, name: string }>}
 */
async function lookupPlayer(query, type) {
  const invalidMessage = type === "uuid" ? "Invalid UUID." : "Invalid username.";

  try {
    const { data } = await get(`https://mowojang.matdoes.dev/${query}`);
    if (data?.id && data?.name) {
      return data;
    }
  } catch (error) {
    // @ts-ignore
    if (error.response?.status === 404) throw invalidMessage;
  }

  const mojangURL =
    type === "uuid"
      ? `https://api.minecraftservices.com/minecraft/profile/lookup/${query}`
      : `https://api.mojang.com/users/profiles/minecraft/${query}`;

  try {
    const { data } = await get(mojangURL);
    if (data.errorMessage || data.id === undefined || data.name === undefined) {
      throw data.errorMessage ?? invalidMessage;
    }

    return data;
  } catch (error) {
    // @ts-ignore
    const status = error.response?.status;
    if (status === 404 || status === 204) throw invalidMessage;
    if (status === 429) throw "Mojang API is rate limiting the bot. Please try again in a minute.";
    console.error(error);
    throw error;
  }
}

/**
 * Get UUID from username
 * @param {string} username
 * @returns {Promise<string>}
 */
async function getUUID(username) {
  const key = username.toLowerCase();
  if (uuidCache.has(key)) {
    const data = uuidCache.get(key);

    if (data.last_save + 43200000 > Date.now()) {
      return data.id;
    }
  }

  const { id, name } = await lookupPlayer(username, "username");

  uuidCache.set(key, { last_save: Date.now(), id });
  usernameCache.set(id, { last_save: Date.now(), username: name });

  return id;
}

/**
 * Get username from UUID
 * @param {string} uuid
 * @returns {Promise<string>}
 */
async function getUsername(uuid) {
  if (usernameCache.has(uuid)) {
    const data = usernameCache.get(uuid);

    if (data.last_save + 43200000 > Date.now()) {
      return data.username;
    }
  }

  const { id, name } = await lookupPlayer(uuid, "uuid");

  usernameCache.set(uuid, { last_save: Date.now(), username: name });
  uuidCache.set(name.toLowerCase(), { last_save: Date.now(), id });

  return name;
}

/**
 * Get UUID from username
 * @param {string} username
 * @returns {Promise<{ username: string, uuid: string }>}
 */
async function resolveUsernameOrUUID(username) {
  const { id, name } = await lookupPlayer(username, "username");

  return {
    username: name,
    uuid: id
  };
}

module.exports = { getUUID, getUsername, resolveUsernameOrUUID };
