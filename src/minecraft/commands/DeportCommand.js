const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");
/** The 193 UN member states and the two observer states (Vatican City, Palestine). */
const COUNTRIES = require("../constants/countries.json");

class CountryCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "deport";
    this.aliases = [];
    this.description = "Deports a user to a random country.";
    this.options = [
      {
        name: "username",
        description: "User to send away",
        required: true
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
      const user = args[0] || player;
      const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];

      this.send(`${user} has been deported to ${country} womp womp!`);
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = CountryCommand;
