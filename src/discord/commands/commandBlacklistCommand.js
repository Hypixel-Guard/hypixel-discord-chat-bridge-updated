const { SuccessEmbed } = require("../../contracts/embedHandler.js");
const { addToBlacklist, removeFromBlacklist } = require("../../contracts/commandBlacklist.js");

module.exports = {
  name: "commandblacklist",
  description: "Add or remove users from the Minecraft (!) command blacklist.",
  moderatorOnly: true,
  options: [
    {
      name: "arg",
      description: "Add or Remove",
      type: 3,
      required: true,
      choices: [
        { name: "Add", value: "add" },
        { name: "Remove", value: "remove" }
      ]
    },
    {
      name: "user",
      description: "Discord user",
      type: 6,
      required: true
    }
  ],

  execute: async (interaction) => {
    const arg = interaction.options.getString("arg");
    const user = interaction.options.getUser("user");

    let message;
    if (arg === "add") {
      message = addToBlacklist(user.id) ? `Added <@${user.id}> to the command blacklist.` : `<@${user.id}> is already on the command blacklist.`;
    } else {
      message = removeFromBlacklist(user.id) ? `Removed <@${user.id}> from the command blacklist.` : `<@${user.id}> is not on the command blacklist.`;
    }

    await interaction.followUp({ embeds: [new SuccessEmbed(message)] });
  }
};
