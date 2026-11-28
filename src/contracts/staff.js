const config = require("../../config.json");

// Guild rank tags, as shown after a name in guild chat.
const STAFF_GUILD_RANKS = ["gm", "admin", "mod", "officer"];

// Same hardcoded role and user the admin Discord commands allow.
const STAFF_ROLE_IDS = ["875442654534582323"];
const STAFF_USER_IDS = ["608284610169798663"];

/** @param {string | undefined} guildRank - With or without brackets and colour codes. */
function isStaffGuildRank(guildRank) {
  const tag = (guildRank ?? "").replace(/§[0-9a-fk-or]|[[\]]/g, "").trim();

  return STAFF_GUILD_RANKS.includes(tag.toLowerCase());
}

/**
 * Unlike the admin command check, this ignores `checkPerms`, which would otherwise make everyone staff.
 * @param {import("discord.js").Message} message
 */
function isStaffDiscordMessage(message) {
  const userId = message?.author?.id;
  if (STAFF_USER_IDS.includes(userId) || config.discord.commands.users.includes(userId)) {
    return true;
  }

  const roles = message?.member?.roles?.cache;
  return [config.discord.commands.commandRole, ...STAFF_ROLE_IDS].some((role) => roles?.has(role) === true);
}

module.exports = { isStaffGuildRank, isStaffDiscordMessage };
