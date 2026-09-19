const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");

class D20Command extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "d20";
    this.aliases = [];
    this.description = "Roll a twenty sided dice.";
    this.options = [];
  }

  /**
   * @param {string} player
   * @param {string} message
   * */
  async onCommand(player, message) {
    try {
      const roll = Math.floor(Math.random() * 20) + 1;

      if (roll === 20) {
        return this.send(`${player} rolled a d20 and got a NATURAL 20!`);
      }

      if (roll === 1) {
        return this.send(`${player} rolled a d20 and got a critical fail... 1`);
      }

      this.send(`${player} rolled a d20 and got ${roll}!`);
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = D20Command;
