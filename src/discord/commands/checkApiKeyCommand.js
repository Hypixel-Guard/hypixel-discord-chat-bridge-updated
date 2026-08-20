const { ErrorEmbed, SuccessEmbed } = require("../../contracts/embedHandler.js");
const { checkApiKeyStatus } = require("../../contracts/API/hypixelKeyValidator.js");
const config = require("../../../config.json");

module.exports = {
  name: "check-api-key",
  description: "Checks whether the bot's Hypixel API key is currently working.",

  execute: async (interaction) => {
    const { status, message } = await checkApiKeyStatus(config.minecraft.API.hypixelAPIkey);

    if (status === "valid") {
      const embed = new SuccessEmbed(message).setAuthor({ name: "Hypixel API Key Healthy" });
      await interaction.followUp({ embeds: [embed] });
      return;
    }

    if (status === "invalid") {
      const embed = new ErrorEmbed(
        `${message}\n\nGenerate a new key at the [Hypixel Developer Dashboard](https://developer.hypixel.net/dashboard) and submit it using \`/update-api-key\`.`
      ).setAuthor({ name: "Hypixel API Key Broken" });
      await interaction.followUp({ embeds: [embed] });
      return;
    }

    const embed = new ErrorEmbed(message).setAuthor({ name: status === "rate-limited" ? "Hypixel API Rate Limited" : "Hypixel API Unavailable" });
    await interaction.followUp({ embeds: [embed] });
  }
};
