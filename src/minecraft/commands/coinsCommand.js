const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatNumber, formatError } = require("../../contracts/helperFunctions.js");

class CoinsCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "coins";
    this.aliases = ["coin", "money"];
    this.description = "Total coins (purse + bank) of specified user.";
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

      const purse = Math.round(profile.currencies?.coin_purse ?? 0);
      const bankBalance = profileData.banking?.balance;
      const personalBank = Math.round(profile.profile?.bank_account ?? 0);
      const bank = Math.round(bankBalance ?? 0) + personalBank;
      const total = purse + bank;

      const bankFormatted = bankBalance === undefined && personalBank === 0 ? "N/A (Bank API off)" : formatNumber(bank);

      this.send(`${username}'s Coins: ${formatNumber(total)} (Purse: ${formatNumber(purse)} | Bank: ${bankFormatted})`);
    } catch (error) {
      console.error(error);
      this.send(formatError(error));
    }
  }
}

module.exports = CoinsCommand;
