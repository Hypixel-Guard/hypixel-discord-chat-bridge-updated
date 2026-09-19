const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");

class D6Command extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "d6";
    this.aliases = ["dice", "roll"];
    this.description = "Roll a six sided dice.";
    this.options = [];
  }

  /**
   * @param {string} player
   * @param {string} message
   * */
  async onCommand(player, message) {
    try {
      const roll = Math.floor(Math.random() * 6) + 1;

      this.send(`${player} rolled a d6 and got ${roll}!`);
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = D6Command;
