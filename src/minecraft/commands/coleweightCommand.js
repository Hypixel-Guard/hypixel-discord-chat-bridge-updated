const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");
// @ts-ignore
const { get } = require("axios");

class ColeweightCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "coleweight";
    this.aliases = ["cw", "cole"];
    this.description = "Coleweight, leaderboard position and top % of specified user.";
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

      const response = await get(`https://ninjune.dev/api/coleweight?username=${encodeURIComponent(player)}`);
      const data = response?.data;
      if (data === undefined) {
        throw "Request to Coleweight API failed. Please try again!";
      }

      // The API returns HTTP 200 with { code, error } in the body for unknown players
      if (data.error) {
        throw data.code === 404 ? `${player} has no Coleweight data.` : data.error;
      }

      this.send(
        `${data.name}'s Coleweight: ${Number(data.coleweight).toLocaleString()} | Rank: #${Number(data.rank).toLocaleString()} | Top ${data.percentile}% (${data.profile})`
      );
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = ColeweightCommand;
