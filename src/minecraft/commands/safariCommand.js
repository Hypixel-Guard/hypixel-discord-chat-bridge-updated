const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");
const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const { getLevelByXp, getOverflowLevel } = require("../../../API/constants/skills.js");
// @ts-ignore
const { get } = require("axios");

const ELITE_API = "https://api.elitebot.dev";
const BIOMES = ["forest", "cavern", "icy", "haunted"];
const TOTAL_CRITTERS = 37;

class SafariCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "safari";
    this.aliases = ["critters"];
    this.description = "Critter Safari overview of specified user.";
    this.options = [
      {
        name: "username",
        description: "Minecraft username",
        required: false
      }
    ];
  }

  /**
   * @param {string} player
   * @param {string} message
   * */
  async onCommand(player, message) {
    try {
      const args = this.getArgs(message);
      player = args[0] || player;

      const { username, profile, profileData, uuid } = await getLatestProfile(player);

      // @ts-ignore
      const safari = profile.safari;
      if (!safari) {
        throw `${username} has not visited the Critter Safari.`;
      }

      const captures = safari.biome_captures ?? {};
      const tickets = safari.tickets ?? {};

      const totalCaptures = BIOMES.reduce((sum, biome) => sum + (captures[biome] ?? 0), 0);
      const captureList = BIOMES.map((biome) => `${biome.charAt(0).toUpperCase()} ${(captures[biome] ?? 0).toLocaleString()}`).join(", ");
      const sparklingDiscovered = safari.discovered_sparkling_critters?.length ?? 0;
      const sparklingCaught = safari.total_captured_sparkling_critters ?? 0;
      const totalTickets = (tickets.basic ?? 0) + (tickets.economy ?? 0) + (tickets.premium ?? 0) + (tickets.first_class ?? 0);
      // @ts-ignore
      const essence = profile.currencies?.essence?.SAFARI?.current ?? 0;

      // @ts-ignore
      const huntingXp = profile.player_data?.experience?.SKILL_HUNTING ?? 0;
      const huntingLevel = getLevelByXp(huntingXp, { type: "hunting" }).level;
      const huntingOverflow = getOverflowLevel(huntingXp).levelWithProgress;

      // Rank is -1 for players below the leaderboard's minimum xp; a failed lookup just shows Unranked
      const rank = await get(`${ELITE_API}/leaderboard/rank/hunting/${uuid.replace(/-/g, "")}/${profileData.profile_id.replace(/-/g, "")}`)
        .then((/** @type {any} */ res) => res?.data?.rank)
        .catch(() => -1);
      const rankText = rank > 0 ? `#${Number(rank).toLocaleString()}` : "Unranked";

      this.send(
        `${username}'s Safari | Hunting ${huntingOverflow.toFixed(2)} (${rankText}) | Captures: ${totalCaptures.toLocaleString()} (${captureList}) | Sparkling: ${sparklingDiscovered}/${TOTAL_CRITTERS} (${sparklingCaught.toLocaleString()} caught) | Tickets: ${totalTickets} | Essence: ${essence.toLocaleString()}`
      );
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = SafariCommand;
