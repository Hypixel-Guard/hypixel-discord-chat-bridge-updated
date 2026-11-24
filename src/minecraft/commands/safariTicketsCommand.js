const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");
const { getLatestProfile } = require("../../../API/functions/getLatestProfile.js");

class SafariTicketsCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "tickets";
    this.aliases = ["safaritickets"];
    this.description = "Safari Tickets of specified user.";
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

      const { username, profile } = await getLatestProfile(player);

      // @ts-ignore
      const tickets = profile.safari?.tickets ?? {};
      const basic = tickets.basic ?? 0;
      const economy = tickets.economy ?? 0;
      const premium = tickets.premium ?? 0;
      const firstClass = tickets.first_class ?? 0;
      const total = basic + economy + premium + firstClass;

      this.send(`${username}: Basic (${basic}), Economy (${economy}), Premium (${premium}), First-Class (${firstClass}), Total (${total})`);
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = SafariTicketsCommand;
