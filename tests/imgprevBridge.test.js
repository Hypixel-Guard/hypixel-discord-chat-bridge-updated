/* global jest */
// End to end through the bridge's own handlers, with Discord and Minecraft faked: a Discord message with images
// reaches Minecraft chat as ImgPrev tokens, and tokens in guild chat reach Discord as images.

const { describe, it, expect, beforeAll, afterAll } = require("@jest/globals");
const { EventEmitter } = require("events");
const axios = require("axios");
const crypto = require("crypto");
const config = require("../config.json");
const TokenCodec = require("../src/contracts/imgprev/tokenCodec.js");
const MessageHandler = require("../src/discord/handlers/MessageHandler.js");
const MinecraftManager = require("../src/minecraft/MinecraftManager.js");
const DiscordManager = require("../src/discord/DiscordManager.js");
const ChatHandler = require("../src/minecraft/handlers/ChatHandler.js");

const ATTACHMENT =
  "https://cdn.discordapp.com/attachments/951417646191083551/1099925527403446302/image.png?ex=66b847f9&is=66b6f679&hm=8202e1159ac4032f2523d4d6b4dba6afe89ddd50c84f2bd9cfe11264ca0c4ac7&";
const FRESH_ATTACHMENT = ATTACHMENT.replace("ex=66b847f9&is=66b6f679", `ex=${(2000000000).toString(16)}&is=${(2000000000 - 86400).toString(16)}`);
const KLIPY_GIF = "https://static.klipy.com/ii/935d7ab9d8c6202580a668421940ec81/14/af/um0L4dFH.gif";
const GIPHY = "https://media.giphy.com/media/XJtM2nNFCzT3etvzOB/giphy.gif";

function collection(items) {
  const map = new Map(items.map((item, i) => [String(i), item]));
  map.first = () => items[0];
  return map;
}

/** The parts of a discord.js Message the bridge reads. */
function discordMessage({ content = "", attachments = [], stickers = [], embeds = [], client = new EventEmitter() }) {
  return {
    id: "1300000000000000001",
    content,
    attachments: collection(attachments),
    stickers: collection(stickers),
    embeds,
    client,
    author: { id: "486155512568741900", bot: false, username: "steve" },
    member: { displayName: "Steve", user: {} },
    channel: { id: config.discord.channels.guildChatChannel },
    guild: { members: { cache: new Map(), fetch: async () => ({ roles: { cache: { map: () => [] } } }) }, channels: { cache: new Map() } },
    reference: null,
    reactions: [],
    react(emoji) {
      this.reactions.push(emoji);
    },
    toString() {
      return content;
    }
  };
}

/** What Discord's message event turns into in Minecraft chat: the bridge's MessageHandler, then MinecraftManager.onBroadcast. */
async function relayToMinecraft(message) {
  const relayed = [];
  await new MessageHandler({ broadcastMessage: (data) => relayed.push({ ...data }) }).onMessage(message);

  const sent = [];
  global.bot = { player: {}, chat: (text) => sent.push(text), on() {}, removeListener() {} };
  const minecraft = { bot: global.bot, chatHandler: { isCommand: () => false } };
  for (const data of relayed) {
    await MinecraftManager.prototype.onBroadcast.call(minecraft, data);
  }

  // onBroadcast checks for the echo from Hypixel after 500 ms.
  await new Promise((resolve) => setTimeout(resolve, 550));

  return sent;
}

function mediaUrls(line) {
  return TokenCodec.findTokens(line).map((m) => m.codec.mediaUri(m.payload));
}

const saved = {};
beforeAll(() => {
  global.client = { user: { id: "1" } };
  saved.mode = config.discord.other.messageMode;
  saved.debugMode = config.discord.channels.debugMode;
  saved.imagePreview = config.imagePreview;
  saved.blacklistRoles = config.discord.commands.blacklistRoles;
  config.discord.channels.debugMode = false;
  config.discord.commands.blacklistRoles = [];
  config.imagePreview = { enabled: true, discordToMinecraft: true, minecraftToDiscord: true, keepEmojiNames: false, embedWaitMs: 300 };
});

afterAll(() => {
  config.discord.other.messageMode = saved.mode;
  config.discord.channels.debugMode = saved.debugMode;
  config.imagePreview = saved.imagePreview;
  config.discord.commands.blacklistRoles = saved.blacklistRoles;
});

describe("Discord to Minecraft", () => {
  it("sends attachments, custom emoji and stickers as tokens", async () => {
    const sent = await relayToMinecraft(
      discordMessage({
        content: "look <:KEKW:1000632669622767686>",
        attachments: [{ name: "image.png", contentType: "image/png", url: ATTACHMENT, proxyURL: ATTACHMENT.replace("cdn.discordapp.com", "media.discordapp.net") }],
        stickers: [{ id: "781291131828699156", name: "Wave", format: 2 }]
      })
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].length).toBeLessThanOrEqual(256);
    expect(sent[0].startsWith("/gc Steve")).toBe(true);
    // Attachments, then the sticker, then the text, as the bridge has always ordered them.
    expect(mediaUrls(sent[0])).toEqual([
      ATTACHMENT,
      "https://media.discordapp.net/stickers/781291131828699156.png?size=320",
      "https://cdn.discordapp.com/emojis/1000632669622767686.png?size=128"
    ]);
    expect(sent[0]).toContain(" look ");
  });

  it("keeps the names of things that can't be previewed", async () => {
    const sent = await relayToMinecraft(
      discordMessage({
        content: "hi",
        attachments: [{ name: "clip.mp4", contentType: "video/mp4", url: ATTACHMENT.replace("image.png", "clip.mp4") }],
        stickers: [{ id: "796140620111544330", name: "Wumpus Wave", format: 3 }]
      })
    );

    expect(sent[0]).toMatch(/\[clip\] \[Wumpus Wave\] hi$/);
    expect(TokenCodec.findTokens(sent[0])).toHaveLength(0);
  });

  it("sends [GIF] instead of a token when Klipy only has the placeholder GIF for a clip", async () => {
    const PLACEHOLDER = Buffer.from("not really the gif");
    const spies = [
      jest.spyOn(axios, "head").mockResolvedValue({ headers: { "content-length": "78534" } }),
      jest.spyOn(axios, "get").mockResolvedValue({ data: PLACEHOLDER })
    ];
    const bridgeMedia = require("../src/contracts/imgprev/bridgeMedia.js");
    // The stand-in body must hash like the real placeholder for the check to fire.
    const realMd5 = "52e983c16a00a92c66eaeb9cbaee2110";
    const hash = jest.spyOn(crypto, "createHash").mockReturnValue({ update: () => ({ digest: () => realMd5 }) });
    try {
      const link = "https://klipy.com/gifs/thats-what-im-sayin";
      const mp4 = "https://static.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/f5/5a/d1eh2iT3RlXzE.mp4";
      const client = new EventEmitter();
      const message = discordMessage({ content: link, client });
      setTimeout(() => client.emit("messageUpdate", message, { ...message, embeds: [{ url: link, video: { url: mp4 } }] }), 50);

      const sent = await relayToMinecraft(message);
      expect(sent[0]).toContain("[GIF]");
      expect(TokenCodec.findTokens(sent[0])).toHaveLength(0);
      expect(await bridgeMedia.isKlipyPlaceholder(mp4.replace(".mp4", ".gif"))).toBe(true);
    } finally {
      hash.mockRestore();
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it("falls back to the GIF named on the Klipy page when the embed's own GIF is the placeholder", async () => {
    const bridgeMedia = require("../src/contracts/imgprev/bridgeMedia.js");
    const PAGE_GIF = "https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/f5/5a/fFcSK4xlzbo24cXwzv.gif";
    const html = `<meta property="og:image" content="https://static2.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/f5/5a/still.webp"/><meta property="og:image" content="${PAGE_GIF}"/>`;
    const head = jest.spyOn(axios, "head").mockImplementation(async (url) => ({ headers: { "content-length": url.includes("d1eh2iT3RlXzE") ? "78534" : "2155617" } }));
    const get = jest.spyOn(axios, "get").mockImplementation(async (url) => ({ data: url.includes("klipy.com/gifs/") ? html : Buffer.from("placeholder") }));
    const hash = jest.spyOn(crypto, "createHash").mockReturnValue({ update: () => ({ digest: () => "52e983c16a00a92c66eaeb9cbaee2110" }) });
    try {
      const embed = {
        url: "https://klipy.com/gifs/dirty-docks-shawty",
        video: { url: "https://static.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/f5/5a/d1eh2iT3RlXzE.mp4" }
      };
      const token = await bridgeMedia.embedTokenChecked(embed);
      expect(mediaUrls(token)).toEqual([PAGE_GIF.replace("static2", "static")]);

      // Blocked page, or one without a GIF: the label, never an error.
      get.mockImplementation(async (url) => {
        if (url.includes("klipy.com/gifs/")) {
          throw new Error("403");
        }

        return { data: Buffer.from("placeholder") };
      });
      expect(await bridgeMedia.embedTokenChecked({ ...embed, url: "https://klipy.com/gifs/other-clip" })).toBe("[GIF]");
      get.mockImplementation(async (url) => ({ data: url.includes("klipy.com/gifs/") ? "<html>nothing here</html>" : Buffer.from("placeholder") }));
      expect(await bridgeMedia.embedTokenChecked({ ...embed, url: "https://klipy.com/gifs/empty-page" })).toBe("[GIF]");
      expect(await bridgeMedia.embedTokenChecked({ video: embed.video })).toBe("[GIF]");
    } finally {
      hash.mockRestore();
      get.mockRestore();
      head.mockRestore();
    }
  });

  it("keeps a Klipy GIF whose size isn't the placeholder's, and fails open when the check can't reach Klipy", async () => {
    const bridgeMedia = require("../src/contracts/imgprev/bridgeMedia.js");
    const head = jest.spyOn(axios, "head").mockResolvedValue({ headers: { "content-length": "4001918" } });
    expect(await bridgeMedia.isKlipyPlaceholder(KLIPY_GIF)).toBe(false);
    head.mockRejectedValue(new Error("offline"));
    expect(await bridgeMedia.isKlipyPlaceholder(KLIPY_GIF)).toBe(false);
    head.mockRestore();
  });

  it("sends a GIF picker link as the GIF from the embed Discord adds a moment later", async () => {
    const client = new EventEmitter();
    const link = "https://klipy.com/gifs/cat-dance-abc";
    const message = discordMessage({ content: link, client });
    setTimeout(() => client.emit("messageUpdate", message, { ...message, embeds: [{ url: link, video: { url: KLIPY_GIF.replace(".gif", ".mp4") } }] }), 50);

    const sent = await relayToMinecraft(message);
    expect(mediaUrls(sent[0])).toEqual([KLIPY_GIF]);
    expect(sent[0]).not.toContain("klipy.com/gifs");
  });

  it("never sends a link it could not turn into a token", async () => {
    const sent = await relayToMinecraft(discordMessage({ content: "https://tenor.com/view/cat-12345 and http://example.com/a.png?x=1, see (https://example.com/page)" }));
    expect(sent[0]).not.toMatch(/https?:/);
    expect(sent[0]).toContain("[link] and [link], see ([link])");
  });

  it("splits long messages without cutting a token", async () => {
    const attachments = Array.from({ length: 3 }, (v, i) => ({ name: `a${i}.png`, contentType: "image/png", url: ATTACHMENT.replace("image.png", `a${i}.png`) }));
    const sent = await relayToMinecraft(discordMessage({ content: "word ".repeat(20), attachments }));
    expect(sent.length).toBeGreaterThan(1);
    expect(sent.every((line) => line.length <= 256)).toBe(true);
    expect(sent.flatMap(mediaUrls)).toHaveLength(3);
  }, 20000);
});

describe("Minecraft to Discord", () => {
  /** Guild chat as Hypixel sends it, through ChatHandler, then DiscordManager.onBroadcast with a fake channel. */
  async function relayToDiscord(line, mode, emojis = new Map()) {
    config.discord.other.messageMode = mode;
    const sends = [];
    const channel = { id: "c", send: async (data) => sends.push(data) };
    const discord = Object.create(DiscordManager.prototype);
    Object.assign(discord, {
      stateHandler: { getChannel: async () => channel },
      client: { emojis: { cache: emojis } },
      toggleChains: new Map(),
      app: { discord: { webhook: { id: "w", send: async (data) => sends.push(data) } } },
      getWebhook: async () => discord.app.discord.webhook
    });

    const events = [];
    const handler = new ChatHandler({ broadcastMessage: (event) => events.push(event), broadcastCleanEmbed() {}, broadcastHeadedEmbed() {} }, { handle() {} });
    handler.bot = { username: "BridgeBot", chat() {} };
    await handler.onMessage({ toString: () => line, toMotd: () => line });
    for (const event of events) {
      await discord.onBroadcast(event);
    }

    return sends;
  }

  const giphy = TokenCodec.encode(GIPHY);
  const klipy = TokenCodec.encode(KLIPY_GIF);

  it("posts bot-mode embeds with the images as a gallery and labels as links", async () => {
    const [sent] = await relayToDiscord(`Guild > [MVP+] Alex [Member]: look ${giphy} and ${klipy}`, "bot");
    const [main, second] = sent.embeds;
    expect(main.description).toBe(`look [▶ GIF](https://i.giphy.com/media/XJtM2nNFCzT3etvzOB/giphy.gif) and [▶ GIF](${KLIPY_GIF})`);
    expect(main.image.url).toBe("https://i.giphy.com/media/XJtM2nNFCzT3etvzOB/giphy.gif");
    expect(second).toEqual({ url: main.url, image: { url: KLIPY_GIF } });
    expect(main.author.name).toBe("Alex");
  });

  it("marks expired Discord attachment links instead of linking them", async () => {
    const [sent] = await relayToDiscord(`Guild > Alex: ${TokenCodec.encode(ATTACHMENT)} ${TokenCodec.encode(FRESH_ATTACHMENT)}`, "webhook");
    expect(sent.content).toBe(`[✉ Discord] (expired) [✉ Discord](${FRESH_ATTACHMENT}) `); // cleanMessage ends each line with a space
    expect(sent.embeds).toEqual([{ url: FRESH_ATTACHMENT, image: { url: FRESH_ATTACHMENT } }]);
  });

  it("posts custom emoji the bot can use inline, and links the rest", async () => {
    const usable = TokenCodec.encode("https://cdn.discordapp.com/emojis/1000632669622767686.gif");
    const other = TokenCodec.encode("https://cdn.discordapp.com/emojis/1049837871772729354.png");
    const emojis = new Map([["1000632669622767686", { toString: () => "<a:KEKW:1000632669622767686>" }]]);
    const [sent] = await relayToDiscord(`Guild > Alex: ${usable} ${other}`, "webhook", emojis);
    expect(sent.content).toBe("<a:KEKW:1000632669622767686> [☺ Emoji](https://cdn.discordapp.com/emojis/1049837871772729354.png?size=128) ");
    expect(sent.embeds.map((e) => e.image.url)).toEqual(["https://cdn.discordapp.com/emojis/1049837871772729354.png?size=128"]);
  });

  it("doesn't send the bot's own relayed Discord messages back to Discord", async () => {
    expect(await relayToDiscord(`Guild > [MVP+] BridgeBot [Staff]: Steve » ${giphy}`, "webhook")).toEqual([]);
    expect(await relayToDiscord(`Guild > [MVP+] BridgeBot [Staff]: Steve » ${giphy} hi`, "bot")).toEqual([]);
  });

  it("leaves messages alone when image previews are off", async () => {
    config.imagePreview.minecraftToDiscord = false;
    const [sent] = await relayToDiscord(`Guild > Alex: ${giphy}`, "webhook");
    config.imagePreview.minecraftToDiscord = true;
    expect(sent.content).toBe(`${giphy} `);
    expect(sent.embeds).toEqual([]);
  });
});
