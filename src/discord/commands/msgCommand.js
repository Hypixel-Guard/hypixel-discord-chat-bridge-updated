const HypixelDiscordChatBridgeError = require("../../contracts/errorHandler.js");
const { SuccessEmbed, ErrorEmbed } = require("../../contracts/embedHandler.js");

module.exports = {
    name: "msg",
    description: "Send a private message to a specific player",
    moderatorOnly: true,
    requiresBot: true,
    options: [
        {
            name: "player",
            description: "Player to message",
            type: 3, // STRING type
            required: true
        },
        {
            name: "message",
            description: "Message to send to the player",
            type: 3, // STRING type
            required: true
        }
    ],

    async execute(interaction) {
        try {
            // Check if user has the required role
            const requiredRoleId = "875442654534582323"; // Hard coded command role
            const userRoles = interaction.member.roles.cache;
            
            if (!userRoles.has(requiredRoleId) && interaction.user.id !== "608284610169798663") {
                const errorEmbed = new ErrorEmbed("You don't have permission to use this command.");
                return await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }

            const player = interaction.options.getString('player');
            const message = interaction.options.getString('message');
            
            // Validate player name (basic validation)
            if (player.length > 16 || player.length < 3) {
                const errorEmbed = new ErrorEmbed("Invalid player name! Must be 3-16 characters.");
                return await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }

            // Validate message length (Minecraft chat has limits)
            if (message.length > 256) {
                const errorEmbed = new ErrorEmbed("Message too long! Maximum 256 characters.");
                return await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }

            // Remove any spaces or special characters that might break the command
            const cleanPlayer = player.replace(/[^a-zA-Z0-9_]/g, '');
            
            // Set up message listener to catch Hypixel's response
            const messagePromise = new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    bot.removeListener("message", listener);
                    resolve({ success: false, reason: "Timeout - no response from Hypixel" });
                }, 3000); // 3 second timeout

                const listener = (msg) => {
                    const messageText = msg.toString().trim();
                    console.log(`[MSG DEBUG] Received message: "${messageText}"`); // Debug line
                    
                    // Check for various Hypixel error responses
                    if (messageText.includes("You cannot message this player") || 
                        messageText.includes("That player is not online") ||
                        messageText.includes("Player not found") ||
                        messageText.includes("You are not allowed to message") ||
                        messageText.includes("has disabled private messages") ||
                        messageText.includes("Cannot send message") ||
                        messageText.includes("is not online") ||
                        messageText.includes("doesn't exist")) {
                        clearTimeout(timeout);
                        bot.removeListener("message", listener);
                        resolve({ success: false, reason: messageText });
                    }
                    // Check for successful message - Hypixel shows "To [RANK] Player: message"
                    else if (messageText.includes(message)) {
                        clearTimeout(timeout);
                        bot.removeListener("message", listener);
                        resolve({ success: true, response: messageText });
                    }
                };

                bot.on("message", listener);
            });

            // Send the private message
            const msgCommand = `/msg ${cleanPlayer} ${message}`;
            bot.chat(msgCommand);
            
            // Wait for Hypixel's response
            const result = await messagePromise;
            
            let embed;
            if (result.success) {
                // Success - message was sent
                embed = new SuccessEmbed("Private Message Sent Successfully")
                    .setDescription(`✅ Message successfully delivered to **${cleanPlayer}**.`)
                    .addFields([
                        {
                            name: 'Player',
                            value: `\`${cleanPlayer}\``,
                            inline: true
                        },
                        {
                            name: 'Message',
                            value: `\`${message}\``,
                            inline: false
                        },
                        {
                            name: 'Server Response',
                            value: `\`${result.response || 'Message sent'}\``,
                            inline: false
                        }
                    ])
                    .setFooter({ text: `Sent by ${interaction.user.tag}` });
                
                console.log(`[${new Date().toISOString()}] SUCCESS: Private message sent by ${interaction.user.tag} to ${cleanPlayer}: "${message}"`);
            } else {
                // Failed - show error reason
                embed = new ErrorEmbed("Private Message Failed")
                    .setDescription(`❌ Could not send message to **${cleanPlayer}**.`)
                    .addFields([
                        {
                            name: 'Player',
                            value: `\`${cleanPlayer}\``,
                            inline: true
                        },
                        {
                            name: 'Attempted Message',
                            value: `\`${message}\``,
                            inline: false
                        },
                        {
                            name: 'Error Reason',
                            value: `\`${result.reason}\``,
                            inline: false
                        }
                    ])
                    .setFooter({ text: `Attempted by ${interaction.user.tag}` });
                
                console.log(`[${new Date().toISOString()}] FAILED: Private message by ${interaction.user.tag} to ${cleanPlayer} failed: ${result.reason}`);
            }
            
            await interaction.followUp({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in msg command:', error);
            throw new HypixelDiscordChatBridgeError(`Message command failed: ${error.message}`);
        }
    }
};
