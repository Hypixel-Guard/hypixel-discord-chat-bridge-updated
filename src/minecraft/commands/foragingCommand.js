const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatNumber, formatError } = require("../../contracts/helperFunctions.js");
const { getHotf } = require("../../../API/stats/hotf.js");

class ForagingCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "foraging";
    this.aliases = ["hotf"];
    this.description = "Skyblock Hotf Stats of specified user.";
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

      const { username, profile, profileData } = await getLatestProfile(player);

      const hotf = getHotf(profile);
      if (hotf == null) {
        throw `${username} has never unlocked the Heart of the Forest on ${profileData.cute_name}.`;
      }

      const foragingXp = profile.player_data?.experience?.SKILL_FORAGING ?? 0;

      this.send(
        `${username}'s Total Foraging XP: ${formatNumber(foragingXp)} | Hotf: ${formatNumber(
          hotf.level.levelWithProgress,
          2
        )} | Forest Whispers: ${formatNumber(hotf.whispers.forest)} | Desert Whispers: ${formatNumber(
          hotf.whispers.desert
        )}`
      );
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = ForagingCommand;
