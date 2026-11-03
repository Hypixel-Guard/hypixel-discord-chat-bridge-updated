const { SuccessEmbed } = require("../../contracts/embedHandler.js");
const { togglePingBlock } = require("../../contracts/pingBlock.js");

module.exports = {
  name: "toggleping",
  description: "Toggle whether guild members can ping you by typing @<your ign> in guild chat.",

  execute: async (interaction) => {
    const blocked = togglePingBlock(interaction.user.id);

    const embed = new SuccessEmbed(blocked ? "You will no longer be pinged when someone mentions you in guild chat." : "You can now be pinged when someone mentions you in guild chat.");
    await interaction.followUp({ embeds: [embed] });
  }
};
