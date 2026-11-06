const { SuccessEmbed } = require("../../contracts/embedHandler.js");
const { addToBlacklist, removeFromBlacklist, getBlacklist } = require("../../contracts/commandBlacklist.js");

module.exports = {
  name: "commandblacklist",
  description: "Add or remove users from the Minecraft (!) command blacklist.",
  moderatorOnly: true,
  options: [
    {
      name: "arg",
      description: "Add, Remove or List",
      type: 3,
      required: true,
      choices: [
        { name: "Add", value: "add" },
        { name: "Remove", value: "remove" },
        { name: "List", value: "list" }
      ]
    },
    {
      name: "user",
      description: "Discord user (required for add/remove)",
      type: 6,
      required: false
    }
  ],

  execute: async (interaction) => {
    const arg = interaction.options.getString("arg");
    const user = interaction.options.getUser("user");

    if (arg === "list") {
      const list = getBlacklist();
      const text = list.length > 0 ? list.map((id) => `<@${id}> (\`${id}\`)`).join("\n") : "The command blacklist is empty.";
      return await interaction.followUp({ embeds: [new SuccessEmbed(text)] });
    }

    if (user === null) {
      throw new (require("../../contracts/errorHandler.js"))("Please provide a user to add or remove.");
    }

    let message;
    if (arg === "add") {
      message = addToBlacklist(user.id) ? `Added <@${user.id}> to the command blacklist.` : `<@${user.id}> is already on the command blacklist.`;
    } else {
      message = removeFromBlacklist(user.id) ? `Removed <@${user.id}> from the command blacklist.` : `<@${user.id}> is not on the command blacklist.`;
    }

    await interaction.followUp({ embeds: [new SuccessEmbed(message)] });
  }
};
