const { Collection } = require("discord.js");
const { cleanText } = require("../contracts/filter.js");
const config = require("../../config.json");
const axios = require("axios");
const { isPlayerBlacklisted } = require("../contracts/commandBlacklist.js");
const fs = require("fs");

// Cooldown per command group, in seconds. A command can override it with `this.cooldownSeconds`.
const GROUP_COOLDOWNS = {
  chance: 10,
  joke: 30
};

class CommandHandler {
  /** @param {import("minecraft-protocol").Client} minecraft */
  constructor(minecraft) {
    this.minecraft = minecraft;
    this.prefix = config.minecraft.bot.prefix;
    this.commands = new Collection();
    this.cooldowns = new Map();
    const commandFiles = fs.readdirSync("./src/minecraft/commands").filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
      const CommandClass = require(`./commands/${file}`);
      // Skip fully commented-out command files (they export an empty object)
      if (typeof CommandClass !== "function") continue;
      const command = new CommandClass(minecraft);
      this.commands.set(command.name, command);
    }
  }

  /**
   * Returns true if the command is still cooling down, otherwise starts its cooldown. The cooldown is
   * per command and shared by all players. Only the first blocked attempt gets a reply.
   */
  isOnCooldown(command) {
    const seconds = command.cooldownSeconds ?? GROUP_COOLDOWNS[command.group];
    if (!seconds) {
      return false;
    }

    const now = Date.now();
    const cooldown = this.cooldowns.get(command.name);
    if (cooldown && now < cooldown.until) {
      if (!cooldown.warned) {
        cooldown.warned = true;
        command.send(`${this.prefix}${command.name} is on cooldown, wait ${Math.ceil((cooldown.until - now) / 1000)}s.`);
      }
      return true;
    }

    this.cooldowns.set(command.name, { until: now + seconds * 1000, warned: false });
    return false;
  }

  handle(player, message, officer, staff = false) {
    if (message.startsWith(this.prefix)) {
      if (config.minecraft.commands.normal === false) {
        return;
      }
      const args = message.slice(this.prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = this.commands.get(commandName) ?? this.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));
      if (command === undefined) {
        return;
      }
      isPlayerBlacklisted(player).then((blocked) => {
        if (blocked) {
          console.minecraft(`${player} - [${command.name}] blocked (command blacklist)`);
          return;
        }
        console.minecraft(`${player} - [${command.name}] ${message}`);
        command.officer = officer;
        // Staff (and anyone in officer chat) skip cooldowns, and their uses don't start one for others.
        command.staff = staff || officer;
        if (!command.staff && this.isOnCooldown(command)) {
          return;
        }
        command.onCommand(player, message);
      });
    } else if (message.startsWith("-") && message.startsWith("- ") === false) {
      if (config.minecraft.commands.soopy === false || message.at(1) === "-") {
        return;
      }
      
      const command = message.slice(1).split(" ")[0];
      
      // Check if the command is disabled
      if (config.minecraft.commands.soopyDisabled && config.minecraft.commands.soopyDisabled.includes(command)) {
        const chat = officer ? "oc" : "gc";
	if (command == "define") {
	  bot.chat(`/${chat} [SOOPY V2] ${player} is too lazy to use a dictionary!`);
	} else {
          bot.chat(`/${chat} [SOOPY V2] Command '${command}' is disabled`);
        }
	return;
      }
      
      if (isNaN(parseInt(command.replace(/[^-()\d/*+.]/g, ""))) === false) {
        return;
      }
      
      const chat = officer ? "oc" : "gc";
      bot.chat(`/${chat} [SOOPY V2] ${cleanText(message)}`);
      console.minecraft(`${player} - [${command}] ${message}`);
      
      (async () => {
        try {
          const URI = encodeURI(`https://soopy.dev/api/guildBot/runCommand?user=${player}&cmd=${message.slice(1)}`);
          const response = await axios.get(URI);
          if (response?.data?.msg === undefined) {
            return bot.chat(`/${chat} [SOOPY V2] An error occured while running the command`);
          }
          bot.chat(`/${chat} [SOOPY V2] ${cleanText(response.data.msg)}`);
        } catch (e) {
          bot.chat(`/${chat} [SOOPY V2] ${e.cause ?? e.message ?? "Unknown error"}`);
        }
      })();
    }
  }
}

module.exports = CommandHandler;
