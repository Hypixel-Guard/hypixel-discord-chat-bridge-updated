const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatNumber, titleCase, formatError } = require("../../contracts/helperFunctions.js");
const { ProfileNetworthCalculator } = require("skyhelper-networth");

const categoryNames = {
  armor: "Armor",
  equipment: "Equipment",
  wardrobe: "Wardrobe",
  inventory: "Inventory",
  enderchest: "Ender Chest",
  accessories: "Accessories",
  personal_vault: "Personal Vault",
  fishing_bag: "Fishing Bag",
  potion_bag: "Potion Bag",
  sacks_bag: "Sacks Bag",
  candy_inventory: "Candy Inventory",
  carnival_mask_inventory: "Carnival Masks",
  storage: "Storage",
  museum: "Museum",
  sacks: "Sacks",
  essence: "Essence",
  pets: "Pets",
  quiver: "Quiver",
  farming_toolkit: "Farming Toolkit",
  hunting_toolkit: "Hunting Toolkit"
};

class NetworthStatsCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "networthstats";
    this.aliases = ["nwstats", "nwbreakdown"];
    this.description = "Breakdown of where a user's networth comes from.";
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

      const { username, profile, museum, profileData } = await getLatestProfile(player, { museum: true });
      const bankingBalance = profileData.banking?.balance ?? 0;

      const networthManager = new ProfileNetworthCalculator(profile, museum, bankingBalance);
      const networthData = await networthManager.getNetworth({ onlyNetworth: true });

      if (networthData.noInventory === true) {
        return this.send(`${username} has an Inventory API off!`);
      }

      const networth = networthData.networth;
      if (!networth) {
        return this.send(`${username}'s Networth is 0`);
      }

      const categories = Object.entries(networthData.types ?? {}).map(([type, data]) => ({
        name: categoryNames[type] ?? titleCase(type),
        total: data?.total ?? 0
      }));

      const coins = (networthData.purse ?? 0) + (networthData.bank ?? 0) + (networthData.personalBank ?? 0);
      categories.push({ name: "Coins", total: coins });

      // Anything under 1% gets lumped into "Other" so the message stays readable
      const sorted = categories.filter((category) => category.total > 0).sort((a, b) => b.total - a.total);
      const major = sorted.filter((category) => category.total / networth >= 0.01);
      const otherTotal = sorted.filter((category) => category.total / networth < 0.01).reduce((sum, category) => sum + category.total, 0);
      if (otherTotal > 0) {
        major.push({ name: "Other", total: otherTotal });
      }

      const parts = major.map((category) => `${category.name}: ${formatNumber(category.total)} (${((category.total / networth) * 100).toFixed(1)}%)`);

      // Discord gets the whole thing in one message; Minecraft chat gets it split at category boundaries
      await this.sendLong(`${username}'s Networth: ${formatNumber(networth)} » ${parts.join(" | ")}`);
    } catch (error) {
      console.error(error);
      this.send(formatError(error));
    }
  }
}

module.exports = NetworthStatsCommand;
