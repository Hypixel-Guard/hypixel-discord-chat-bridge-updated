const { ErrorEmbed, SuccessEmbed } = require("../../contracts/embedHandler.js");
const { checkApiKeyStatus } = require("../../contracts/API/hypixelKeyValidator.js");
const config = require("../../../config.json");

const TITLE_BY_STATUS = {
  invalid: "Hypixel API Key Rejected",
  "rate-limited": "Hypixel API Rate Limited",
  unavailable: "Hypixel API Unavailable"
};

module.exports = {
  name: "check-api-key",
  description: "Checks whether Hypixel's API is currently reachable and accepting the bot's key.",
  // Visible to the whole channel so everyone can see why Hypixel data isn't loading.
  publicReply: true,

  execute: async (interaction) => {
    const { status, message } = await checkApiKeyStatus(config.minecraft.API.hypixelAPIkey);

    if (status === "valid") {
      const embed = new SuccessEmbed(message).setAuthor({ name: "Hypixel API Healthy" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new ErrorEmbed(message).setAuthor({ name: TITLE_BY_STATUS[status] });
    await interaction.editReply({ embeds: [embed] });
  }
};
