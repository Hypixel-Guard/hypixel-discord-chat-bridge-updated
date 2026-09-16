const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { ErrorEmbed, SuccessEmbed } = require("../../contracts/embedHandler.js");
const { checkApiKeyStatus } = require("../../contracts/API/hypixelKeyValidator.js");
const hypixelRebornAPI = require("../../contracts/API/HypixelRebornAPI.js");
const config = require("../../../config.json");
const fs = require("fs");

const MODAL_CUSTOM_ID = "force-api-key-modal";
const INPUT_CUSTOM_ID = "new-api-key";

module.exports = {
  name: "force-api-key",
  description: "Moderator only: replace the bot's Hypixel API key regardless of whether the current one is working.",
  moderatorOnly: true,
  opensModal: true,
  modalCustomId: MODAL_CUSTOM_ID,

  execute: async (interaction) => {
    // Unlike /update-api-key, there's no check on the current key and no cooldown; the modal opens straight away.
    const modal = new ModalBuilder().setCustomId(MODAL_CUSTOM_ID).setTitle("Force Update Hypixel API Key");
    const input = new TextInputBuilder()
      .setCustomId(INPUT_CUSTOM_ID)
      .setLabel("New Hypixel API key")
      .setStyle(TextInputStyle.Short)
      .setMinLength(30)
      .setMaxLength(50)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  /**
   * @param {import("discord.js").ModalSubmitInteraction} interaction
   */
  handleModalSubmit: async (interaction) => {
    const newApiKey = interaction.fields.getTextInputValue(INPUT_CUSTOM_ID).trim();
    const { status, message } = await checkApiKeyStatus(newApiKey);

    // Only a definitive rejection from Hypixel blocks the update. If Hypixel is rate-limiting or down we can't tell
    // either way, so apply the key anyway - that's the situation the non-forced command gets stuck in.
    if (status === "invalid") {
      await interaction.editReply({ embeds: [new ErrorEmbed(`That key isn't valid: ${message}`)] });
      return;
    }

    config.minecraft.API.hypixelAPIkey = newApiKey;
    fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

    hypixelRebornAPI.reinitialize(newApiKey);

    const note = status === "valid" ? "" : `\n\n**Warning:** the key could not be verified before applying it. ${message}`;
    await interaction.editReply({ embeds: [new SuccessEmbed(`The Hypixel API key has been force-updated and is now active.${note}`)] });
  }
};
