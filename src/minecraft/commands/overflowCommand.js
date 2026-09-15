const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const { titleCase } = require("../../contracts/helperFunctions.js");
const { getOverflowLevel } = require("../../../API/constants/skills.js");
const { skillTables } = require("../../../API/constants/leveling.js");
const { getSkills } = require("../../../API/stats/skills.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

class OverflowCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "overflow";
    this.aliases = ["of"];
    this.description = "Shows the overflow skill average and each skill's level, including post-60 overflow levels.";
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

      // Cosmetic skills (runecrafting, social) can't overflow and aren't part of
      // the skill average, so leaving them out keeps the message inside the chat limit.
      const levels = Object.entries(skills)
        .filter(([type]) => !skillTables.cosmeticSkills.includes(type))
        .map(([type, data]) => {
          const overflow = getOverflowLevel(data.xp);
          const level = overflow.overflowLevel > 0 ? overflow.levelWithProgress : data.levelWithProgress;

          return { type, level };
        });

      const average = levels.reduce((total, { level }) => total + level, 0) / levels.length;
      const formattedSkills = levels.map(({ type, level }) => `${titleCase(type)} ${level.toFixed(2)}`);

      this.send(`${username}'s Overflow Skill Average: ${average.toFixed(2)} | ${formattedSkills.join(", ")}`);
    } catch (error) {
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = OverflowCommand;
