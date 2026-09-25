const { Client, Collection, AttachmentBuilder, GatewayIntentBits } = require("discord.js");
const CommunicationBridge = require("../contracts/CommunicationBridge.js");
const { replaceVariables } = require("../contracts/helperFunctions.js");
const messageToImage = require("../contracts/messageToImage.js");
const MessageHandler = require("./handlers/MessageHandler.js");
const StateHandler = require("./handlers/StateHandler.js");
const CommandHandler = require("./CommandHandler.js");
const config = require("../../config.json");
const fs = require("fs");
const { ErrorEmbed } = require("../contracts/embedHandler.js");

class DiscordManager extends CommunicationBridge {
  constructor(app) {
    super();

    this.app = app;

    this.stateHandler = new StateHandler(this);
    this.messageHandler = new MessageHandler(this);
    this.commandHandler = new CommandHandler(this);

    // Consecutive join / leave messages are collapsed into a single message with a (xN) counter.
    // Keyed by channel id, a chain holds the toggle messages that may still be edited; it is
    // broken as soon as any other message lands in that channel.
    this.toggleChains = new Map();
    this.toggleQueues = new Map();
  }

  connect() {
    global.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
    });

    this.client = client;

    this.client.on("ready", () => this.stateHandler.onReady());
    this.client.on("messageCreate", (message) => {
      if (this.isBridgeMessage(message) === false) {
        this.breakToggleChain(message.channel.id);
      }

      this.messageHandler.onMessage(message);
    });

    this.client.login(config.discord.bot.token).catch((error) => {
      console.error(error);
    });

    client.commands = new Collection();
    const commandFiles = fs.readdirSync("src/discord/commands").filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const command = require(`./commands/${file}`);
      if (command.verificationCommand === true && config.verification.enabled === false) {
        continue;
      }

      if (command.channelsCommand === true && config.statsChannels.enabled === false) {
        continue;
      }

      if (command.inactivityCommand === true && config.verification.inactivity.enabled === false) {
        continue;
      }

      const commandName = command.data?.name ?? command.name;
      if (!commandName) {
        console.error(`Skipping command file with missing name: ${file}`);
        continue;
      }

      client.commands.set(commandName, command);
    }

    const eventFiles = fs.readdirSync("src/discord/events").filter((file) => file.endsWith(".js"));
    for (const file of eventFiles) {
      const event = require(`./events/${file}`);
      event.once ? client.once(event.name, (...args) => event.execute(...args)) : client.on(event.name, (...args) => event.execute(...args));
    }

    process.on("SIGINT", async () => {
      await this.stateHandler.onClose();

      process.kill(process.pid, "SIGTERM");
    });
  }

  async getWebhook(discord, type) {
    const channel = await this.stateHandler.getChannel(type);
    try {
      const webhooks = await channel.fetchWebhooks();

      if (webhooks.size === 0) {
        channel.createWebhook({
          name: "Hypixel Chat Bridge",
          avatar: "https://imgur.com/tgwQJTX.png"
        });

        await this.getWebhook(discord, type);
      }

      return webhooks.first();
    } catch (error) {
      console.log(error);
      channel.send({
        embeds: [new ErrorEmbed("An error occurred while trying to fetch the webhooks. Please make sure the bot has the `MANAGE_WEBHOOKS` permission.")]
      });
    }
  }

  async onBroadcast({ fullMessage, chat, chatType, username, rank, guildRank, message, color = 1752220 }) {
    if ((chat === undefined && chatType !== "debugChannel") || ((username === undefined || message === undefined) && chat !== "debugChannel")) {
      return;
    }

    const mode = chat === "debugChannel" ? config.discord.channels.debugChannelMessageMode.toLowerCase() : config.discord.other.messageMode.toLowerCase();
    message = ["text"].includes(mode) ? fullMessage : message;
    if (message !== undefined && chat !== "debugChannel") {
      console.broadcast(`${username} [${guildRank.replace(/§[0-9a-fk-or]/g, "").replace(/^\[|\]$/g, "")}]: ${message}`, `Discord`);
    }

    if (mode === "minecraft") {
      message = replaceVariables(config.discord.other.messageFormat, { chatType, username, rank, guildRank, message });
    }

    const channel = await this.stateHandler.getChannel(chat || "Guild");
    if (channel === undefined) {
      console.error(`Channel ${chat.replace(/§[0-9a-fk-or]/g, "").trim()} not found!`);
      return;
    }

    this.breakToggleChain(channel.id);

    switch (mode) {
      case "bot":
        await channel.send({
          embeds: [
            {
              description: message,
              color: this.hexToDec(color),
              timestamp: new Date(),
              footer: {
                text: guildRank
              },
              author: {
                name: username,
                icon_url: `https://www.mc-heads.net/avatar/${username}`
              }
            }
          ]
        });

        if (message.includes("https://")) {
          const links = message.match(/https?:\/\/[^\s]+/g).join("\n");

          channel.send(links);
        }

        break;

      case "webhook":
        message = this.cleanMessage(message);
        if (message.length === 0) {
          return;
        }

        this.app.discord.webhook = await this.getWebhook(this.app.discord, chatType);
        if (this.app.discord.webhook === undefined) {
          return;
        }

        this.app.discord.webhook.send({
          content: message,
          username: username,
          avatarURL: `https://www.mc-heads.net/avatar/${username}`
        });
        break;

      case "minecraft":
        if (fullMessage.length === 0) {
          return;
        }

        await channel.send({
          files: [
            new AttachmentBuilder(await messageToImage(message, username), {
              name: `${username}.png`
            })
          ]
        });

        if (message.includes("https://")) {
          const links = message.match(/https?:\/\/[^\s]+/g).join("\n");

          channel.send(links);
        }
        break;

      case "text":
        if (message.trim().length === 0) {
          return;
        }

        await channel.send({
          content: message
        });
        break;

      default:
        throw new Error("Invalid message mode: must be bot, webhook or minecraft");
    }
  }

  async onBroadcastCleanEmbed({ message, color, channel }) {
    console.broadcast(message, "Event");

    channel = await this.stateHandler.getChannel(channel);
    if (channel === undefined) {
      console.log(`Channel ${channel.replace(/§[0-9a-fk-or]/g, "").trim()} not found!`);
    }

    this.breakToggleChain(channel.id);

    channel.send({
      embeds: [
        {
          color: color,
          description: message
        }
      ]
    });
  }

  async onBroadcastHeadedEmbed({ message, title, icon, color, channel }) {
    console.broadcast(message, "Event");

    channel = await this.stateHandler.getChannel(channel);
    if (channel === undefined) {
      console.log(`Channel ${channel.replace(/§[0-9a-fk-or]/g, "").trim()} not found!`);
      return;
    }

    this.breakToggleChain(channel.id);

    channel.send({
      embeds: [
        {
          color: color,
          author: {
            name: title,
            icon_url: icon
          },
          description: message
        }
      ]
    });
  }

  async onPlayerToggle({ fullMessage, username, message, color, channel }) {
    console.broadcast(message, "Event");

    channel = await this.stateHandler.getChannel(channel);
    if (channel === undefined) {
      console.log(`Channel ${channel.replace(/§[0-9a-fk-or]/g, "").trim()} not found!`);
      return;
    }

    // Toggles are queued per channel so two of them cannot both decide to start the same chain.
    return this.queueToggle(channel.id, () => this.sendPlayerToggle({ fullMessage, username, message, color, channel }));
  }

  async sendPlayerToggle({ fullMessage, username, message, color, channel }) {
    const mode = config.discord.other.messageMode.toLowerCase();
    if (["bot", "webhook", "minecraft"].includes(mode) === false) {
      throw new Error("Invalid message mode: must be bot, webhook or minecraft");
    }

    const chain = this.getToggleChain(channel.id);
    const key = `${mode}:${message}`;

    let count = 1;
    const entry = chain.get(key);
    if (entry !== undefined) {
      count = entry.count + 1;

      // Only edit in place while it is still the newest toggle, otherwise e.g. leave, join, leave would
      // leave the "join" message at the bottom and show the player in the wrong state.
      if ([...chain.keys()].pop() === key) {
        try {
          return await this.editToggleMessage(entry, { fullMessage, username, message, color, count });
        } catch (error) {
          // The message is gone (deleted, too old, ...) so start a fresh one for it.
          console.error(error);
        }
      } else {
        await this.deleteToggleMessage(entry).catch((error) => console.error(error));
      }

      chain.delete(key);
    }

    const sent = await this.sendToggleMessage({ fullMessage, username, message, color, channel, mode, count });
    if (sent === undefined) {
      return;
    }

    chain.set(key, { ...sent, count });

    // Only a handful of players can realistically be flickering at once, keep the chain small.
    while (chain.size > 20) {
      chain.delete(chain.keys().next().value);
    }
  }

  async sendToggleMessage({ fullMessage, username, message, color, channel, mode, count = 1 }) {
    switch (mode) {
      case "bot": {
        const sent = await channel.send({ embeds: [this.toggleEmbed({ message, color, username, count })] });

        return { mode, message: sent };
      }

      case "webhook": {
        message = this.cleanMessage(message);
        if (message.length === 0) {
          return undefined;
        }

        this.app.discord.webhook = await this.getWebhook(this.app.discord, "Guild");
        if (this.app.discord.webhook === undefined) {
          return undefined;
        }

        const webhook = this.app.discord.webhook;
        const sent = await webhook.send({
          username: username,
          avatarURL: `https://www.mc-heads.net/avatar/${username}`,
          embeds: [{ color: color, description: `${message}${this.repeatSuffix(count)}` }]
        });

        return { mode, webhook: webhook, messageId: sent.id };
      }

      case "minecraft": {
        const sent = await channel.send({
          files: [
            new AttachmentBuilder(await messageToImage(count > 1 ? `${fullMessage}§7${this.repeatSuffix(count)}` : fullMessage), {
              name: `${username}.png`
            })
          ]
        });

        return { mode, message: sent };
      }
    }
  }

  async editToggleMessage(entry, { fullMessage, username, message, color, count }) {
    switch (entry.mode) {
      case "bot":
        await entry.message.edit({ embeds: [this.toggleEmbed({ message, color, username, count })] });
        break;

      case "webhook":
        await entry.webhook.editMessage(entry.messageId, {
          embeds: [{ color: color, description: `${this.cleanMessage(message)}${this.repeatSuffix(count)}` }]
        });
        break;

      case "minecraft":
        await entry.message.edit({
          attachments: [],
          files: [
            new AttachmentBuilder(await messageToImage(`${fullMessage}§7${this.repeatSuffix(count)}`), {
              name: `${username}.png`
            })
          ]
        });
        break;
    }

    entry.count = count;
  }

  async deleteToggleMessage(entry) {
    if (entry.mode === "webhook") {
      return entry.webhook.deleteMessage(entry.messageId);
    }

    return entry.message.delete();
  }

  toggleEmbed({ message, color, username, count }) {
    return {
      color: color,
      timestamp: new Date(),
      author: {
        name: `${message}${this.repeatSuffix(count)}`,
        icon_url: `https://www.mc-heads.net/avatar/${username}`
      }
    };
  }

  repeatSuffix(count) {
    return count > 1 ? ` (x${count})` : "";
  }

  getToggleChain(channelId) {
    if (this.toggleChains.has(channelId) === false) {
      this.toggleChains.set(channelId, new Map());
    }

    return this.toggleChains.get(channelId);
  }

  breakToggleChain(channelId) {
    this.toggleChains.delete(channelId);
  }

  queueToggle(channelId, task) {
    const queue = (this.toggleQueues.get(channelId) ?? Promise.resolve()).then(task, task);

    this.toggleQueues.set(
      channelId,
      queue.catch((error) => console.error(error))
    );

    return queue;
  }

  isBridgeMessage(message) {
    return message.author?.id === this.client?.user?.id || (message.webhookId != null && message.webhookId === this.app.discord?.webhook?.id);
  }

  hexToDec(hex) {
    if (hex === undefined) {
      return 1752220;
    }

    if (typeof hex === "number") {
      return hex;
    }

    return parseInt(hex.replace("#", ""), 16);
  }

  cleanMessage(message) {
    if (message === undefined) {
      return "";
    }

    return message
      .split("\n")
      .map((part) => {
        part = part.trim();
        return part.length === 0 ? "" : part.replace(/@(everyone|here)/gi, "").trim() + " ";
      })
      .join("");
  }

  formatMessage(message, data) {
    return replaceVariables(message, data);
  }
}

module.exports = DiscordManager;
