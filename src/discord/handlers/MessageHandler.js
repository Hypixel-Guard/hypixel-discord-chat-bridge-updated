const config = require("../../../config.json");
const { unemojify } = require("node-emoji");
const { LINK, convertAll, replaceLinks, trimTrailing } = require("../../contracts/imgprev/linkConverter.js");
const { settings, toMinecraft, emojiToken, stickerToken, attachmentToken, embedToken, splitMessage } = require("../../contracts/imgprev/bridgeMedia.js");
const TokenCodec = require("../../contracts/imgprev/tokenCodec.js");

// Links whose image or GIF only shows up once Discord has embedded them (its GIF picker posts Klipy or Tenor pages),
// worth waiting a moment for before the message is relayed.
const EMBEDDED_MEDIA_HOSTS = ["klipy.com", "www.klipy.com", "tenor.com", "www.tenor.com", "giphy.com", "www.giphy.com", "gph.is", "imgur.com", "www.imgur.com"];

// Discord user IDs that are always shown under a fixed name when running bot commands, regardless of nickname
const commandNameOverrides = {
  "608284610169798663": "thyrandomone"
};

class MessageHandler {
  constructor(discord, command) {
    this.discord = discord;
    this.command = command;
  }

  async onMessage(message) {
    try {
      if (message.author.id === client.user.id || !this.shouldBroadcastMessage(message)) {
        return;
      }

      const discordUser = await message.guild.members.fetch(message.author.id);
      const memberRoles = discordUser.roles.cache.map((role) => role.id);
      if (memberRoles.some((role) => config.discord.commands.blacklistRoles.includes(role))) {
        return;
      }

      const content = (await this.stripDiscordContent(message)).trim();
      if (content.length === 0 && message.attachments.size === 0) {
        return;
      }

      const isCommand = content.startsWith(config.minecraft.bot.prefix);
      const username = (isCommand ? commandNameOverrides[message.author.id] : undefined) ?? message.member.displayName ?? message.author.username;
      if (username === undefined || username.length === 0) {
        return;
      }

      const formattedUsername = unemojify(username);

      const messageData = {
        member: message.member.user,
        channel: message.channel.id,
        username: formattedUsername.replaceAll(" ", ""),
        message: content,
        replyingTo: await this.fetchReply(message),
        discord: message
      };

      if (messageData.message.length === 0) {
        return;
      }

      if (messageData.message.length > 220) {
        // Split at spaces, so an ImgPrev token is never cut in two.
        const messageParts = splitMessage(messageData.message, 200);
        if (messageParts.length === 0) {
          return;
        }

        for (const part of messageParts) {
          messageData.message = part;
          this.discord.broadcastMessage(messageData);
          await new Promise((resolve) => setTimeout(resolve, 1000));

          if (messageParts.indexOf(part) >= 3) {
            messageData.message = "Message too long. Truncated.";
            this.discord.broadcastMessage(messageData);
            return;
          }
        }

        return;
      }

      this.discord.broadcastMessage(messageData);
    } catch (error) {
      console.error(error);
    }
  }

  async fetchReply(message) {
    try {
      if (message.reference?.messageId === undefined) {
        return null;
      }

      const reference = await message.fetchReference();

      if (reference.author.id === client.user.id) {
        const embedName = reference.embeds[0]?.author?.name;
        if (embedName) {
          return embedName;
        }

        const attachmentName = reference.attachments.first()?.name;
        if (attachmentName) {
          return attachmentName.split(".")[0];
        }
      }

      if (reference.webhookId) {
        return reference.author.username;
      }

      const member = reference.member ?? (await message.guild.members.fetch(reference.author.id).catch(() => null));
      return member?.displayName ?? reference.author.globalName ?? reference.author.username ?? null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async stripDiscordContent(message) {
    const images = toMinecraft();
    let output = message.content
      .split("\n")
      .map((part) => {
        part = part.trim();
        return part.length === 0 ? "" : part.replace(/@(everyone|here)/gi, "").trim() + " ";
      })
      .join("");

    if (images) {
      output = await this.linksToTokens(message, output);
    }

    const hasMentions = /<@|<#|<:|<a:/.test(message);
    if (hasMentions) {
      // Replace <@486155512568741900> with @DuckySoLucky
      const userMentionPattern = /<@(\d+)>/g;
      const replaceUserMention = (match, mentionedUserId) => {
        const mentionedUser = message.guild.members.cache.get(mentionedUserId);

        return `@${mentionedUser.displayName}`;
      };
      output = output.replace(userMentionPattern, replaceUserMention);

      // Replace <#1072863636596465726> with #💬・guild-chat
      const channelMentionPattern = /<#(\d+)>/g;
      const replaceChannelMention = (match, mentionedChannelId) => {
        const mentionedChannel = message.guild.channels.cache.get(mentionedChannelId);

        return `#${mentionedChannel.name}`;
      };
      output = output.replace(channelMentionPattern, replaceChannelMention);

      // Replace <:KEKW:628249422253391902> with :KEKW: || Replace <a:KEKW:628249422253391902> with :KEKW:
      // With image previews on, each becomes an ImgPrev token instead (after :KEKW: with keepEmojiNames).
      const emojiMentionPattern = /<(a?):(\w+):(\d+)>/g;
      output = output.replace(emojiMentionPattern, (match, animated, name, id) => {
        const token = images ? emojiToken(id, animated === "a") : null;
        if (token === null) {
          return `:${name}:`;
        }

        return settings().keepEmojiNames ? `:${name}: ${token}` : token;
      });
    }

    if (message.stickers.size > 0) {
      const sticker = message.stickers.first();
      const shown = (images ? stickerToken(sticker) : null) ?? `[${sticker.name}]`;
      output = output ? `${shown} ${output}` : shown;
    }

    if (message.attachments.size > 0) {
      const attachments = [...message.attachments.values()]
        .map((attachment) => {
          const token = images ? attachmentToken(attachment) : null;
          if (token !== null) {
            return token;
          }

          const dot = attachment.name.lastIndexOf(".");
          const clean = (dot !== -1 ? attachment.name.slice(0, dot) : attachment.name).replace(/\./g, "_");
          return `[${clean}]`;
        })
        .join(" ");

      output = output ? `${attachments} ${output}` : attachments;
    }

    // Replace IP Adresses with [Content Redacted]
    const IPAddressPattern = /(?:\d{1,3}\s*\s\s*){3}\d{1,3}/g;
    output = output.replaceAll(IPAddressPattern, "[Content Redacted]");

    output = unemojify(output);

    return output;
  }

  /**
   * Image links become ImgPrev tokens. Links that only show an image once Discord embeds them (GIF picker and GIF
   * site pages) take the token of the embed's GIF, waiting briefly for Discord to add the embed.
   */
  async linksToTokens(message, text) {
    text = await convertAll(text);

    const links = [...text.matchAll(LINK)].map(([link]) => trimTrailing(link));
    if (links.length === 0) {
      return text;
    }

    const waitFor = links.some((link) => EMBEDDED_MEDIA_HOSTS.includes(TokenCodec.parseHttps(link)?.host));
    const embeds = waitFor ? await this.awaitEmbeds(message) : message.embeds;
    const tokens = new Map();
    for (const link of links) {
      // Discord keeps the link as posted in the embed's url; with one link and one embed they go together anyway.
      const embed = embeds.find((e) => e.url === link) ?? (links.length === 1 && embeds.length === 1 ? embeds[0] : undefined);
      const token = embed === undefined ? null : embedToken(embed);
      if (token !== null) {
        tokens.set(link, token);
      }
    }

    return replaceLinks(text, (link) => tokens.get(link) ?? null);
  }

  /** The message's embeds, once Discord has added them (it does so in an update just after the message) or the wait runs out. */
  awaitEmbeds(message) {
    if (message.embeds.length > 0) {
      return Promise.resolve(message.embeds);
    }

    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        message.client.off("messageUpdate", onUpdate);
        resolve(message.embeds);
      };
      const onUpdate = (oldMessage, newMessage) => {
        if (newMessage.id === message.id && newMessage.embeds.length > 0) {
          message = newMessage;
          finish();
        }
      };
      const timer = setTimeout(finish, settings().embedWaitMs);
      message.client.on("messageUpdate", onUpdate);
    });
  }

  shouldBroadcastMessage(message) {
    const isBot = message.author.bot && config.discord.channels.allowedBots.includes(message.author.id) === false ? true : false;
    const isValid = !isBot && (message.content.length > 0 || message.attachments.size > 0 || message.stickers.size > 0);
    const validChannelIds = [config.discord.channels.officerChannel, config.discord.channels.guildChatChannel, config.discord.channels.debugChannel];

    return isValid && validChannelIds.includes(message.channel.id);
  }
}

module.exports = MessageHandler;
