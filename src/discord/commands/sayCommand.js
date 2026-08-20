const HypixelDiscordChatBridgeError = require("../../contracts/errorHandler.js");
const { SuccessEmbed, ErrorEmbed } = require("../../contracts/embedHandler.js");

module.exports = {
    name: "say",
    description: "Send a message to guild chat as the bot",
    moderatorOnly: true,
    requiresBot: true,
    options: [
        {
            name: "message",
            description: "Message to send to guild chat",
            type: 3, // STRING type
            required: true
        }
    ],

    async execute(interaction) {
        try {
            // Check if user has the required role
            const requiredRoleId = "875442654534582323"; // Hard coded command role
            const userRoles = interaction.member.roles.cache;
            
            if (!userRoles.has(requiredRoleId)) {
                const errorEmbed = new ErrorEmbed("You don't have permission to use this command.");
                return await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }

            const message = interaction.options.getString('message');
            
            // Validate message length (Minecraft chat has limits)
            if (message.length > 256) {
                const errorEmbed = new ErrorEmbed("Message too long! Maximum 256 characters.");
                return await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }

            // Send the message to guild chat with /gc prefix
            const guildChatCommand = `/gc ${message}`;
            bot.chat(guildChatCommand);
            
            // Confirm the message was sent
            const successEmbed = new SuccessEmbed("Message Sent to Guild Chat")
                .setDescription(`Successfully sent message to guild chat.`)
                .addFields([
                    {
                        name: 'Message',
                        value: `\`${message}\``,
                        inline: false
                    },
                    {
                        name: 'Command Executed',
                        value: `\`${guildChatCommand}\``,
                        inline: false
                    }
                ])
                .setFooter({ text: `Sent by ${interaction.user.tag}` });
            
            await interaction.followUp({ embeds: [successEmbed] });
            
            // Log the action
            console.log(`[${new Date().toISOString()}] Manual guild chat message sent by ${interaction.user.tag} (${interaction.user.id}): "${message}"`);
            
        } catch (error) {
            console.error('Error in say command:', error);
            throw new HypixelDiscordChatBridgeError(`Say command failed: ${error.message}`);
        }
    }
};
