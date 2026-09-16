const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getGarden } = require("../../../API/stats/garden.js");

class GardenCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "garden";
    this.aliases = [];
    this.description = "Skyblock Garden Stats of specified user.";
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
      // CREDITS: by @Kathund (https://github.com/Kathund)
      const args = this.getArgs(message);
      player = args[0] || player;

      const { username, garden } = await getLatestProfile(player, { garden: true });
      if (!garden) {
        return this.send(`[ERROR] ${username} does not have a garden.`);
      }

      const gardenData = getGarden(garden);
      if (!gardenData) {
        return this.send(`[ERROR] ${username} does not have a garden.`);
      }

      const milestones = [
        ["Wheat", "wheat"],
        ["Carrot", "carrot"],
        ["Cane", "sugarCane"],
        ["Potato", "potato"],
        ["Wart", "netherWart"],
        ["Pumpkin", "pumpkin"],
        ["Melon", "melon"],
        ["Shroom", "mushroom"],
        ["Cocoa", "cocoaBeans"],
        ["Cactus", "cactus"],
        ["Moon", "moonflower"],
        ["Sun", "sunflower"],
        ["Rose", "wildRose"]
      ]
        // @ts-ignore
        .map(([label, key]) => `${label}: ${gardenData.cropMilesstone[key].level}`)
        .join(" | ");

      // Keep this under the 256 char chat limit (including the "/gc " prefix) so it isn't split into two messages.
      this.send(`${username}'s Garden ${gardenData.level.level} | Crop Milestones (avg ${gardenData.average}): ${milestones}`);
    } catch (error) {
      console.log(error);
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = GardenCommand;
