const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { formatError } = require("../../contracts/helperFunctions.js");
// @ts-ignore
const { get } = require("axios");

const ELITE_API = "https://api.elitebot.dev";

class FarmingweightCommand extends minecraftCommand {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    super(minecraft);

    this.name = "farmingweight";
    this.aliases = ["fw", "fweight"];
    this.description = "Farming weight and leaderboard position of specified user.";
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

      // The weight endpoints only accept UUIDs, so resolve the username first
      const account = await get(`${ELITE_API}/account/${encodeURIComponent(player)}`)
        .then((res) => res.data)
        .catch((error) => {
          throw error?.response?.status === 404 ? `${player} has no Farming Weight data.` : error;
        });

      const weight = (await get(`${ELITE_API}/weight/${account.id}`))?.data;
      const profile = weight?.profiles?.find((p) => p.profileId === weight.selectedProfileId) ?? weight?.profiles?.[0];
      if (profile === undefined) {
        throw `${account.name} has no Farming Weight data.`;
      }

      const [rankResponse, leaderboardResponse] = await Promise.all([
        get(`${ELITE_API}/leaderboard/rank/farmingweight/${account.id}/${profile.profileId}`),
        get(`${ELITE_API}/leaderboard/farmingweight?limit=1`)
      ]);

      // Rank is -1 for players below the leaderboard's minimum weight
      const rank = rankResponse?.data?.rank;
      const totalEntries = leaderboardResponse?.data?.maxEntries;
      let rankText = "Unranked";
      if (rank > 0) {
        rankText = `#${Number(rank).toLocaleString()}`;
        if (totalEntries > 0) {
          // Round up so the top players show e.g. 0.01% instead of 0%
          rankText += ` | Top ${Math.ceil((rank / totalEntries) * 10000) / 100}%`;
        }
      }

      this.send(
        `${account.name}'s Farming Weight: ${Number(profile.totalWeight).toLocaleString(undefined, { maximumFractionDigits: 2 })} | Rank: ${rankText} (${profile.profileName})`
      );
    } catch (error) {
      this.send(formatError(error));
    }
  }
}

module.exports = FarmingweightCommand;
