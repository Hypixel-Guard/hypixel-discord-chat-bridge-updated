const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const { getObsidianCollection } = require("../../../API/stats/collections.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatNumber } = require("../../contracts/helperFunctions.js");

class ObsidianCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "obby";
    this.aliases = ["obsidian"];
    this.description = "Skyblock Obsidian collection of specified user.";
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

      const obsidian = getObsidianCollection(profile);
      if (obsidian == null) {
        throw `${username} has never collected obsidian on ${profileData.cute_name}.`;
      }

      this.send(`${username}'s Obsidian Collection: ${formatNumber(obsidian)}`);
    } catch (error) {
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = ObsidianCommand;
