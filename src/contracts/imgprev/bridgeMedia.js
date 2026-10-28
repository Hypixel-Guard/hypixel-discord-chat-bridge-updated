// What the bridge does with ImgPrev tokens (github.com/CJWM-Dev/imgprev): Discord images, GIFs, emoji and stickers go
// to Minecraft as tokens, which players with the ImgPrev mod see as hover previews, and tokens in Minecraft chat come
// back to Discord as the images they stand for.

const config = require("../../../config.json");
const TokenCodec = require("./tokenCodec.js");
const { labelText } = require("./sites.js");

const DEFAULTS = {
  enabled: true,
  discordToMinecraft: true,
  minecraftToDiscord: true,
  keepEmojiNames: false,
  embedWaitMs: 2500
};

/** config.imagePreview over the defaults; Configuration.js adds the section to older config files at startup. */
function settings() {
  return { ...DEFAULTS, ...(config.imagePreview ?? {}) };
}

function toMinecraft() {
  const s = settings();
  return s.enabled && s.discordToMinecraft;
}

function toDiscord() {
  const s = settings();
  return s.enabled && s.minecraftToDiscord;
}

function emojiToken(id, animated) {
  return TokenCodec.encode(`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`);
}

/** discord.js StickerFormatType: 1 PNG, 2 APNG, 3 Lottie (JSON, no image), 4 GIF. */
function stickerToken(sticker) {
  const ext = { 1: "png", 2: "png", 4: "gif" }[sticker.format];
  return ext === undefined ? null : TokenCodec.encode(`https://media.discordapp.net/stickers/${sticker.id}.${ext}`);
}

/** Images and GIFs only; Discord's signed links work for about a day, which is plenty for chat. */
function attachmentToken(attachment) {
  if (!String(attachment.contentType ?? "").startsWith("image/")) {
    return null;
  }

  return TokenCodec.encode(attachment.url) ?? TokenCodec.encode(attachment.proxyURL);
}

/**
 * The GIF behind a GIF site's video or still: Tenor serves the full GIF for any of a post's keys once it ends in
 * .gif, and Klipy serves .gif beside every .mp4, .webp and .png of the same name.
 */
function gifVariant(url) {
  const u = TokenCodec.parseHttps(url);
  if (u === null) {
    return null;
  }

  // A Tenor key is an 8-byte post id and a 4-byte rendition code; the mod only rewrites codes under 256 to the GIF
  // (2), and the MP4 in Discord's embeds is code 1000, so set it here.
  const tenor = u.path.match(/^(?:\/m)?\/([A-Za-z0-9_-]{16})\/[^/]+$/);
  if (["media.tenor.com", "media1.tenor.com", "c.tenor.com"].includes(u.host) && tenor) {
    const key = Buffer.from(tenor[1], "base64url");
    key.writeUInt32BE(2, 8);
    return `https://media.tenor.com/${key.toString("base64url")}/tenor.gif`;
  }

  const klipy = u.path.match(/^(\/ii\/[0-9a-f]{32}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[A-Za-z0-9]{4,32})\.(?:mp4|webm|webp|png|jpe?g)$/i);
  if (/^static\d?\.klipy\.com$/.test(u.host) && klipy) {
    return `https://static.klipy.com${klipy[1]}.gif`;
  }

  return null;
}

/** A token for an image or GIF link, trying the GIF form of GIF sites' videos first. */
function mediaLinkToken(url) {
  if (typeof url !== "string") {
    return null;
  }

  const gif = gifVariant(url);
  return (gif === null ? null : TokenCodec.encode(gif)) ?? TokenCodec.encode(url);
}

/** The token for what a link embed shows: Discord's GIF picker and GIF sites' page links only become media here. */
function embedToken(embed) {
  for (const media of [embed.video, embed.image, embed.thumbnail]) {
    const token = mediaLinkToken(media?.url);
    if (token !== null) {
      return token;
    }
  }

  return null;
}

/**
 * The ImgPrev media in a line of Minecraft chat, in order.
 * @returns {{ token: string, index: number, url: string | null, label: string, site: string, expired: boolean, emoji: { id: string, animated: boolean } | null }[]}
 */
function mediaInText(text, nowSec = Date.now() / 1000) {
  return TokenCodec.findTokens(text).map((m) => {
    let url = null;
    try {
      url = m.codec.mediaUri(m.payload);
    } catch (error) {
      // a token that decodes but names nothing downloadable
    }

    const expiresAt = m.codec.expiresAtEpochSec(m.payload);
    const emoji = m.codec.name === "emoji" && url !== null ? { id: new URL(url).pathname.match(/(\d+)\./)[1], animated: m.payload[0] === "a" } : null;
    return { token: m.token, index: m.index, url, label: labelText(m.codec.label), site: m.codec.name, expired: expiresAt !== null && expiresAt <= nowSec, emoji };
  });
}

/** text with each token replaced by replace(media); tokens that don't decode stay as they are. */
function replaceTokens(text, replace, nowSec) {
  let out = "";
  let last = 0;
  for (const media of mediaInText(text, nowSec)) {
    out += text.slice(last, media.index) + replace(media);
    last = media.index + media.token.length;
  }

  return out + text.slice(last);
}

/**
 * Splits text into chat messages of at most max characters at spaces, never inside a token: a token longer than
 * the space left starts the next message. Words with no space to split at are cut where they reach max.
 */
function splitMessage(text, max) {
  const parts = [];
  let current = "";
  for (const word of text.split(" ")) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (candidate.length <= max) {
      current = candidate;
      continue;
    }

    if (current !== "") {
      parts.push(current);
    }

    current = word;
    const isToken = TokenCodec.findTokens(word).length > 0;
    while (current.length > max && !isToken) {
      parts.push(current.slice(0, max));
      current = current.slice(max);
    }
  }

  if (current !== "") {
    parts.push(current);
  }

  return parts;
}

module.exports = {
  settings,
  toMinecraft,
  toDiscord,
  emojiToken,
  stickerToken,
  attachmentToken,
  gifVariant,
  mediaLinkToken,
  embedToken,
  mediaInText,
  replaceTokens,
  splitMessage
};
