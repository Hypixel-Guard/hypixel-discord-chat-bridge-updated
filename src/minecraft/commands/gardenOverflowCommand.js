const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const { getCropOverflowLevel } = require("../../../API/constants/skills.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");

class GardenOverflowCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "gardenoverflow";
    this.aliases = ["gof", "cropoverflow"];
    this.description = "Shows the overflow crop milestone average and each crop's milestone, including post-46 overflow tiers.";
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

      const { username, garden } = await getLatestProfile(player, { garden: true });
      if (!garden) {
        return this.send(`[ERROR] ${username} does not have a garden.`);
      }

      const resources = garden.resources_collected ?? {};

      // getCropOverflowLevel ignores the 46 tier cap: past it every tier costs the same as the final tier
      // of the crop's table (e.g. wheat keeps needing 800k per tier forever).
      const crops = [
        ["Wheat", "WHEAT"],
        ["Carrot", "CARROT_ITEM"],
        ["Cane", "SUGAR_CANE"],
        ["Potato", "POTATO_ITEM"],
        ["Wart", "NETHER_STALK"],
        ["Pumpkin", "PUMPKIN"],
        ["Melon", "MELON"],
        ["Shroom", "MUSHROOM_COLLECTION"],
        ["Cocoa", "INK_SACK:3"],
        ["Cactus", "CACTUS"],
        ["Moon", "MOONFLOWER"],
        ["Sun", "DOUBLE_PLANT"],
        ["Rose", "WILD_ROSE"]
        // @ts-ignore
      ].map(([label, cropId]) => ({ label, level: getCropOverflowLevel(resources[cropId], cropId).levelWithProgress }));

      const average = crops.reduce((total, { level }) => total + level, 0) / crops.length;
      const milestones = crops.map(({ label, level }) => `${label}: ${level.toFixed(2)}`).join(", ");

      // Keep this under the 256 char chat limit (including the "/gc " prefix) so it isn't split into two messages.
      this.send(`${username}'s Garden Overflow (avg ${average.toFixed(2)}): ${milestones}`);
    } catch (error) {
      console.log(error);
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = GardenOverflowCommand;
