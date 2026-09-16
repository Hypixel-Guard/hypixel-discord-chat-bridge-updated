const minecraftCommand = require("../../contracts/minecraftCommand.js");

class FlipCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "flip";
    this.aliases = ["coinflip", "coin"];
    this.description = "Flip a coin.";
    this.options = [];
  }

  /**
   * @param {string} player
   * @param {string} message
   * */
  async onCommand(player, message) {
    try {
      const result = Math.random() < 0.5 ? "Heads" : "Tails";

      this.send(`${player} flipped a coin and got ${result}!`);
    } catch (error) {
      this.send(`[ERROR] ${error}`);
    }
  }
}

module.exports = FlipCommand;
