const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");
const getHotm = require("../../../API/stats/hotm.js");

class ForgeCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "forge";
    this.aliases = [];
    this.description = "Skyblock Forge Info Stats of specified user.";
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

      const forge = getHotm.getForge(profile);
      if (forge == null) {
        throw `${username} has never gone to Dwarven Mines on ${profileData.cute_name}.`;
      }

      if (forge.length === 0 || forge == null) {
        throw `${username} has no items in their forge.`;
      }

      const forgeItems = forge.map((item) => `${item.slot}: ${item.name} ${item.timeFinishedText}`);
      const MAX_LENGTH = 250;
      const prefix = `${username}'s Forge: `;
      const full = `${prefix}${forgeItems.join(" | ")}`;

      if (full.length <= MAX_LENGTH) {
        this.send(full);
        return;
      }

      // Split into messages on item boundaries, hard-splitting any single oversized item
      const chunks = [];
      let current = prefix;
      let hasItem = false;
      for (let item of forgeItems) {
        while (prefix.length + item.length > MAX_LENGTH) {
          if (hasItem) {
            chunks.push(current);
            current = prefix;
            hasItem = false;
          }
          const room = MAX_LENGTH - prefix.length;
          chunks.push(prefix + item.slice(0, room));
          item = item.slice(room);
        }
        const candidate = hasItem ? `${current} | ${item}` : `${current}${item}`;
        if (candidate.length > MAX_LENGTH) {
          chunks.push(current);
          current = prefix + item;
        } else {
          current = candidate;
        }
        hasItem = true;
      }
      if (hasItem) chunks.push(current);

      for (const chunk of chunks) {
        this.send(chunk);
      }
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = ForgeCommand;
