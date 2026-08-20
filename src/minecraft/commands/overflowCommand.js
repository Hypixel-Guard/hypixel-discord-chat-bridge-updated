const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const { formatNumber, titleCase } = require("../../contracts/helperFunctions.js");
const { getOverflowLevel } = require("../../../API/constants/skills.js");
const { getSkills } = require("../../../API/stats/skills.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

class OverflowCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "overflow";
    this.aliases = ["of"];
    this.description = "Shows each skill's level and total xp, including post-60 overflow levels.";
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

      const skills = getSkills(profile, profileData);
      if (!skills) {
        return this.send(`${username} has no skills.`);
      }

      const formattedSkills = Object.entries(skills).map(([type, data]) => {
        const overflow = getOverflowLevel(data.xp);
        const level = overflow.overflowLevel > 0 ? overflow.levelWithProgress : data.levelWithProgress;

        return `${titleCase(type)}: ${level.toFixed(2)}, ${formatNumber(data.xp)} XP`;
      });

      this.send(`${username}'s Overflow: ${formattedSkills.join(", ")}`);
    } catch (error) {
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = OverflowCommand;
