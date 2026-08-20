const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { ErrorEmbed, SuccessEmbed } = require("../../contracts/embedHandler.js");
const { checkApiKeyStatus } = require("../../contracts/API/hypixelKeyValidator.js");
const hypixelRebornAPI = require("../../contracts/API/HypixelRebornAPI.js");
const config = require("../../../config.json");
const fs = require("fs");

const MODAL_CUSTOM_ID = "update-api-key-modal";
const INPUT_CUSTOM_ID = "new-api-key";
const SUBMIT_COOLDOWN_MS = 60000;

const lastSubmissionByUser = new Map();

module.exports = {
  name: "update-api-key",
  description: "Replace the bot's Hypixel API key when it stops working.",
  opensModal: true,
  modalCustomId: MODAL_CUSTOM_ID,

  execute: async (interaction) => {
    // showModal() must be the interaction's first response, so this check can't be deferred first;
    // keep the timeout short to stay inside Discord's ~3s ack window.
    const { status, message } = await checkApiKeyStatus(config.minecraft.API.hypixelAPIkey, 2500);

    if (status !== "invalid") {
      const reason =
        status === "valid" ? "The current Hypixel API key is working, so there's nothing to replace." : `${message} This isn't a broken key, so replacing it won't help right now.`;

      await interaction.reply({ embeds: [new ErrorEmbed(reason)], ephemeral: true });
      return;
    }

    const modal = new ModalBuilder().setCustomId(MODAL_CUSTOM_ID).setTitle("Update Hypixel API Key");
    const input = new TextInputBuilder().setCustomId(INPUT_CUSTOM_ID).setLabel("New Hypixel API key").setStyle(TextInputStyle.Short).setMinLength(30).setMaxLength(50).setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await interaction.showModal(modal);
  },

  /**
   * @param {import("discord.js").ModalSubmitInteraction} interaction
   */
  handleModalSubmit: async (interaction) => {
    const userId = interaction.user.id;
    const lastAttempt = lastSubmissionByUser.get(userId);

    if (lastAttempt !== undefined && Date.now() - lastAttempt < SUBMIT_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((SUBMIT_COOLDOWN_MS - (Date.now() - lastAttempt)) / 1000);
      await interaction.editReply({ embeds: [new ErrorEmbed(`Please wait ${remainingSeconds}s before trying again.`)] });
      return;
    }

    lastSubmissionByUser.set(userId, Date.now());

    const newApiKey = interaction.fields.getTextInputValue(INPUT_CUSTOM_ID).trim();
    const { status, message } = await checkApiKeyStatus(newApiKey);

    if (status !== "valid") {
      await interaction.editReply({ embeds: [new ErrorEmbed(`That key isn't valid: ${message}`)] });
      return;
    }

    config.minecraft.API.hypixelAPIkey = newApiKey;
    fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

    hypixelRebornAPI.reinitialize(newApiKey);

    await interaction.editReply({ embeds: [new SuccessEmbed("The Hypixel API key has been updated and is now active.")] });
  }
};
