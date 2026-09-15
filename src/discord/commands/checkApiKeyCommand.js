const { ErrorEmbed, SuccessEmbed } = require("../../contracts/embedHandler.js");
const { checkApiKeyStatus } = require("../../contracts/API/hypixelKeyValidator.js");
const config = require("../../../config.json");

module.exports = {
  name: "check-api-key",
  description: "Checks whether the bot's Hypixel API key is currently working.",
  // Visible to the whole channel so everyone can see when the key needs fixing.
  publicReply: true,

  execute: async (interaction) => {
    const { status, message } = await checkApiKeyStatus(config.minecraft.API.hypixelAPIkey);

    if (status === "valid") {
      const embed = new SuccessEmbed(message).setAuthor({ name: "Hypixel API Key Healthy" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (status === "invalid") {
      const embed = new ErrorEmbed(
        `${message}\n\nGenerate a new key at the [Hypixel Developer Dashboard](https://developer.hypixel.net/dashboard) and submit it using \`/update-api-key\`.\n\n**EVERYONE can edit this even you, yes you reading this can edit and fix this.**`
      ).setAuthor({ name: "Hypixel API Key Broken" });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new ErrorEmbed(message).setAuthor({ name: status === "rate-limited" ? "Hypixel API Rate Limited" : "Hypixel API Unavailable" });
    await interaction.editReply({ embeds: [embed] });
  }
};
