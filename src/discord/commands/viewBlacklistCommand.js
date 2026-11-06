const { SuccessEmbed } = require("../../contracts/embedHandler.js");
const { getBlacklist } = require("../../contracts/commandBlacklist.js");

module.exports = {
  name: "viewblacklist",
  description: "View the users blacklisted from using Minecraft (!) commands.",
  moderatorOnly: true,

  execute: async (interaction) => {
    const list = getBlacklist();
    const text = list.length > 0 ? list.map((id) => `<@${id}> (\`${id}\`)`).join("\n") : "The command blacklist is empty.";

    await interaction.followUp({ embeds: [new SuccessEmbed(text)] });
  }
};
