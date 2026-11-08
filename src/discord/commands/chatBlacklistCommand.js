const { SuccessEmbed } = require("../../contracts/embedHandler.js");
const { getChatBlacklist, addToChatBlacklist, removeFromChatBlacklist } = require("../../contracts/chatBlacklist.js");

module.exports = {
  name: "chatblacklist",
  description: "Stop (or resume) bridging a Discord user's messages to Hypixel guild chat.",
  moderatorOnly: true,
  options: [
    {
      name: "arg",
      description: "Add, Remove or View",
      type: 3,
      required: true,
      choices: [
        { name: "Add", value: "add" },
        { name: "Remove", value: "remove" },
        { name: "View", value: "view" }
      ]
    },
    {
      name: "user",
      description: "Discord user (not needed for View)",
      type: 6,
      required: false
    }
  ],

  execute: async (interaction) => {
    const arg = interaction.options.getString("arg");
    const user = interaction.options.getUser("user");

    let message;
    if (arg === "view") {
      const list = getChatBlacklist();
      message = list.length > 0 ? list.map((id) => `<@${id}> (\`${id}\`)`).join("\n") : "The chat blacklist is empty.";
    } else if (user === null) {
      message = "Please provide a user.";
    } else if (arg === "add") {
      message = addToChatBlacklist(user.id) ? `Added <@${user.id}> to the chat blacklist. Their messages are no longer bridged.` : `<@${user.id}> is already on the chat blacklist.`;
    } else {
      message = removeFromChatBlacklist(user.id) ? `Removed <@${user.id}> from the chat blacklist.` : `<@${user.id}> is not on the chat blacklist.`;
    }

    await interaction.followUp({ embeds: [new SuccessEmbed(message)] });
  }
};
