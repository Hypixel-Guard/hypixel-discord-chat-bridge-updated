// eslint-disable-next-line import/extensions
const { Routes } = require("discord-api-types/v9");
const config = require("../../config.json");
const { REST } = require("@discordjs/rest");
const fs = require("fs");

function getCommandName(command) {
  return command.data?.name ?? command.name;
}

function getCommandRegistrationBody(command) {
  return command.data?.toJSON ? command.data.toJSON() : command;
}

class CommandHandler {
  constructor(discord) {
    this.discord = discord;
    const commands = [];
    const commandNames = new Set(); // Track command names
    const duplicates = []; // Track duplicates
    
    const commandFiles = fs.readdirSync("src/discord/commands").filter((file) => file.endsWith(".js"));
    
    for (const file of commandFiles) {
      const command = require(`./commands/${file}`);
      
      if (command.inactivityCommand === true && config.verification.inactivity.enabled == false) {
        continue;
      }
      if (command.verificationCommand === true && config.verification.enabled === false) {
        continue;
      }
      if (command.channelsCommand === true && config.statsChannels.enabled === false) {
        continue;
      }

      const commandName = getCommandName(command);
      if (!commandName) {
        console.error(`Skipping command file with missing name: ${file}`);
        continue;
      }
      
      // Check for duplicate command names
      if (commandNames.has(commandName)) {
        duplicates.push(`Duplicate command name "${commandName}" found in file: ${file}`);
      } else {
        commandNames.add(commandName);
      }
      
      console.log(`Loading command: ${commandName} from file: ${file}`); // Debug log
      commands.push(getCommandRegistrationBody(command));
    }
    
    // Log all duplicates if found
    if (duplicates.length > 0) {
      console.error("=== DUPLICATE COMMAND NAMES FOUND ===");
      duplicates.forEach(duplicate => console.error(duplicate));
      console.error("=== END DUPLICATES ===");
      console.error("All command names:", Array.from(commandNames));
    }
    
    const rest = new REST({ version: "10" }).setToken(config.discord.bot.token);
    const clientID = Buffer.from(config.discord.bot.token.split(".")[0], "base64").toString("ascii");
    
    rest.put(Routes.applicationGuildCommands(clientID, config.discord.bot.serverID), { body: commands })
      .catch((e) => {
        console.error("Error registering commands:");
        console.error(e);
        console.error("Command names being registered:", commands.map(cmd => cmd.name));
      });
  }
}

module.exports = CommandHandler;
