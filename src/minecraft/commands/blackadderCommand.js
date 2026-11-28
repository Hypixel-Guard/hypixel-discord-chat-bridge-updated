const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");
const quotes = require("../constants/blackadderQuotes.json");

class BlackadderCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "blackadder";
    this.aliases = ["ba"];
    this.description = "Get a random Blackadder quote.";
    this.options = [];
  }

  /**
   * @param {string} player
   * @param {string} message
   * */
  async onCommand(player, message) {
    try {
      const quote = quotes[Math.floor(Math.random() * quotes.length)];

      // Long quotes are split between words for Minecraft chat; Discord gets them in one piece.
      await this.sendLong(quote, { separator: " " });
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = BlackadderCommand;
