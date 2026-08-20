const { SuccessEmbed, ErrorEmbed } = require("../../contracts/embedHandler.js");

module.exports = {
 name: "boop",
 description: "Boop a player in Minecraft",
 requiresBot: true,
 options: [
   {
     name: "ign",
     description: "The IGN of the player to boop",
     type: 3,
     required: true
   }
 ],
 execute: async (interaction) => {
   const ign = interaction.options.getString("ign");
   
   try {
     bot.chat(`/boop ${ign}`);
     
     const commandMessage = new SuccessEmbed(`Successfully booped ${ign}`);
     await interaction.followUp({ embeds: [commandMessage], ephemeral: true });
   } catch (error) {
     console.error("Error executing boop command:", error);
     
     const errorMessage = new ErrorEmbed(`Failed to boop ${ign}: ${error.message}`);
     await interaction.followUp({ embeds: [errorMessage], ephemeral: true });
   }
 }
};
