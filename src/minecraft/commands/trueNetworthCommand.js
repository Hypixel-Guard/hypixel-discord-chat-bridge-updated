const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatNumber } = require("../../contracts/helperFunctions.js");
const { ProfileNetworthCalculator } = require("skyhelper-networth");

class TrueNetWorthCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "truenetworth";
    this.aliases = ["tnw"];
    this.description = "TRUE networth of specified user.";
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

      const { username, rawUsername, profile, museum, profileData } = await getLatestProfile(player, { museum: true });
      const bankingBalance = profileData.banking?.balance ?? 0;

      const networthManager = new ProfileNetworthCalculator(profile, museum, bankingBalance);
      const networthData = await networthManager.getNetworth({ onlyNetworth: true });

      if (networthData.noInventory === true) {
        return this.send(`${username} has an Inventory API off!`);
      }

      const multiplier = rawUsername.toLowerCase() === "thyrandomone" ? 2.5 : 0.75;
      const trueNetworth = formatNumber(networthData.networth * multiplier);

      this.send(`${username}'s TRUE networth is ${trueNetworth}`);
    } catch (error) {
      console.error(error);
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = TrueNetWorthCommand;
