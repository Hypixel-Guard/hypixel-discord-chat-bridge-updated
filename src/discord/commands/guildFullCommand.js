const HypixelDiscordChatBridgeError = require("../../contracts/errorHandler.js");
const { Embed } = require("../../contracts/embedHandler.js");
const { MEMBER_CAPACITY, refreshGuildMemberCount } = require("../../minecraft/other/guildCapacityMonitor.js");

module.exports = {
  name: "guildfull",
  description: "Check how full the Hypixel guild is.",
  requiresBot: true,

  execute: async (interaction) => {
    let memberCount;
    try {
      memberCount = await refreshGuildMemberCount();
    } catch {
      throw new HypixelDiscordChatBridgeError("Could not retrieve the guild member count. Please try again.");
    }

    const openSlots = Math.max(MEMBER_CAPACITY - memberCount, 0);
    const fullness = Math.min(Math.round((memberCount / MEMBER_CAPACITY) * 100), 100);

    const embed = new Embed()
      .setAuthor({ name: "Guild Capacity" })
      .setDescription(
        `There are currently **${memberCount}** people in the guild.\n**${memberCount} / ${MEMBER_CAPACITY}** members (${fullness}% full)\n**${openSlots}** open ${
          openSlots === 1 ? "slot" : "slots"
        }`
      );

    await interaction.followUp({ embeds: [embed] });
  },
};
