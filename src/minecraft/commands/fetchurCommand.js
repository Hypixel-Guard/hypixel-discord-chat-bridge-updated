const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");
const { getFetchur } = require("../../../API/functions/getFetchur.js");

class FetchurCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "fetchur";
    this.aliases = [];
    this.description = "Information about an item for Fetchur.";
    this.options = [];
  }

  /**
   * @param {string} player
   * @param {string} message
   * */
  async onCommand(player, message) {
    try {
      const { text, description } = getFetchur();

      this.send(`Fetchur Requests: ${text} | Description: ${description}`);
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = FetchurCommand;
