const { describe, it, expect } = require("@jest/globals");
const fs = require("fs");
const path = require("path");
const Base62 = require("../src/contracts/imgprev/base62.js");
const Mixed = require("../src/contracts/imgprev/mixed.js");
const TokenCodec = require("../src/contracts/imgprev/tokenCodec.js");
const LinkConverter = require("../src/contracts/imgprev/linkConverter.js");
const BridgeMedia = require("../src/contracts/imgprev/bridgeMedia.js");

// Written by the ImgPrev mod's `./gradlew tokenVectors` from its corpus of real links: link, token, v1 token, site,
// download URL, expiry. Links that must not convert have only the first column.
const VECTORS = fs
  .readFileSync(path.join(__dirname, "fixtures", "imgprev-token-vectors.tsv"), "utf8")
  .trim()
  .split("\n")
  .map((line) => {
    const [url, token = "", v1 = "", site = "", media = "", expires = ""] = line.split("\t");
    return { url, token, v1, site, media, expires };
  });

const GIPHY = "https://media.giphy.com/media/XJtM2nNFCzT3etvzOB/giphy.gif";
const KLIPY_GIF = "https://static.klipy.com/ii/935d7ab9d8c6202580a668421940ec81/14/af/um0L4dFH.gif";
const ATTACHMENT =
  "https://cdn.discordapp.com/attachments/951417646191083551/1099925527403446302/image.png?ex=66b847f9&is=66b6f679&hm=8202e1159ac4032f2523d4d6b4dba6afe89ddd50c84f2bd9cfe11264ca0c4ac7&";

describe("ImgPrev token port", () => {
  describe("Base62 and Mixed", () => {
    it("round-trips numbers", () => {
      for (const n of [0n, 1n, 61n, 62n, 2n ** 64n - 1n, 2n ** 256n + 12345n]) {
        expect(Base62.decode(Base62.encode(n))).toBe(n);
      }

      expect(Base62.encode(61n)).toBe("z");
      expect(() => Base62.decode("a.b")).toThrow();
    });

    it("packs fields in their own radix and takes them back in reverse", () => {
      const m = new Mixed()
        .put(4, 7)
        .putBits(2n ** 63n, 64)
        .putString("abc", "abc", 1, 5);
      const back = Mixed.fromBase62(m.toBase62());
      expect(back.takeString("abc", 1, 5)).toBe("abc");
      expect(back.takeBits(64)).toBe(2n ** 63n);
      expect(back.take(7)).toBe(4);
      expect(back.isEmpty()).toBe(true);
      expect(() => new Mixed().put(7, 7)).toThrow();
    });
  });

  describe("matches the mod on every corpus link", () => {
    const sites = [...new Set(VECTORS.map((v) => v.site || "refused"))];
    it.each(sites)("%s", (site) => {
      const rows = VECTORS.filter((v) => (v.site || "refused") === site);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect([row.url, TokenCodec.encode(row.url)]).toEqual([row.url, row.token || null]);
        for (const token of [row.token, row.v1].filter(Boolean)) {
          const media = TokenCodec.decode(token);
          expect([token, media?.codec.name]).toEqual([token, row.site]);
          expect([token, media.codec.mediaUri(media.payload)]).toEqual([token, row.media]);
          expect([token, String(media.codec.expiresAtEpochSec(media.payload) ?? "")]).toEqual([token, row.expires]);
        }
      }
    });

    it("covers every site and the links that must not convert", () => {
      expect(sites.sort()).toEqual(["catbox", "discord", "emoji", "giphy", "gyazo", "imgbb", "imgur", "klipy", "postimages", "refused", "sticker", "tenor"]);
    });
  });

  describe("decoding", () => {
    it("refuses a token whose check character is wrong", () => {
      const token = TokenCodec.encode(GIPHY);
      const at = token.length - 3;
      const bad = token.slice(0, at) + (token[at] === "A" ? "B" : "A") + "~>";
      expect(TokenCodec.decode(token)).not.toBeNull();
      expect(TokenCodec.decode(bad)).toBeNull();
    });

    it("never throws on made-up payloads", () => {
      const letters = Base62.A;
      let seed = 7;
      const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      for (let i = 0; i < 3000; i++) {
        const site = "GITEDSZYPBC"[Math.floor(random() * 11)];
        let payload = "";
        for (let j = 1 + Math.floor(random() * 90); j > 0; j--) {
          payload += letters[Math.floor(random() * 62)];
        }

        const body = site + payload;
        const media = TokenCodec.decode(`<~${body}${TokenCodec.check(body)}~>`);
        if (media !== null) {
          expect(typeof media.key).toBe("string");
        }
      }
    });

    it("finds every token in a line of chat", () => {
      const giphy = TokenCodec.encode(GIPHY);
      const found = TokenCodec.findTokens(`Guild > [MVP+] Bot [Staff]: Steve » look ${giphy} and <~Gnope1~> ${TokenCodec.encode(KLIPY_GIF)}`);
      expect(found.map((m) => m.codec.name)).toEqual(["giphy", "klipy"]);
      expect(found[0].token).toBe(giphy);
    });
  });

  describe("link converter", () => {
    it("converts links in text, leaving sentence punctuation and other links alone", () => {
      const out = LinkConverter.convertNow(`see ${GIPHY}, and https://example.com/x.png.`);
      expect(out).toBe(`see ${TokenCodec.encode(GIPHY)}, and https://example.com/x.png.`);
    });

    it("looks up Postimages share pages for their image", async () => {
      const pages = [];
      const fetcher = async (url) => {
        pages.push(url);
        return { status: 200, contentType: "text/html; charset=utf-8", body: '<meta property="og:image" content="https://i.postimg.cc/XqRyT9nn/Screenshot.png">' };
      };
      const out = await LinkConverter.convertAll("look https://postimg.cc/AbCdEf12 !", fetcher);
      expect(pages).toEqual(["https://postimg.cc/AbCdEf12"]);
      expect(out).toBe(`look ${TokenCodec.encode("https://i.postimg.cc/XqRyT9nn/image.png")} !`);
    });

    it("leaves a page link as typed when its lookup fails or it points elsewhere", async () => {
      const elsewhere = async () => ({ status: 200, contentType: "text/html", body: '<meta property="og:image" content="https://evil.example/x.png">' });
      await expect(LinkConverter.convertAll("https://ibb.co/M5f2dMkG", elsewhere)).resolves.toBe("https://ibb.co/M5f2dMkG");
      await expect(LinkConverter.convert("https://ibb.co/M5f2dMkG", async () => ({ status: 404, contentType: "", body: "" }))).rejects.toThrow("ImgBB page not found");
      await expect(LinkConverter.convertAll("https://klipy.com/gifs/cat-dance", elsewhere)).resolves.toBe("https://klipy.com/gifs/cat-dance");
    });
  });

  describe("bridge media", () => {
    it("makes tokens for Discord emoji, stickers and image attachments", () => {
      expect(
        TokenCodec.decode(BridgeMedia.emojiToken("1000632669622767686", true)).codec.mediaUri(
          TokenCodec.decode(BridgeMedia.emojiToken("1000632669622767686", true)).payload
        )
      ).toBe("https://cdn.discordapp.com/emojis/1000632669622767686.gif?size=128");
      const sticker = (id, format) => {
        const token = BridgeMedia.stickerToken({ id, format });
        return token === null ? null : TokenCodec.decode(token).codec.mediaUri(TokenCodec.decode(token).payload);
      };
      expect(sticker("781291131828699156", 2)).toBe("https://media.discordapp.net/stickers/781291131828699156.png?size=320");
      expect(sticker("1234567890123456789", 4)).toBe("https://media.discordapp.net/stickers/1234567890123456789.gif?size=320");
      expect(sticker("796140620111544330", 3)).toBeNull();
      expect(BridgeMedia.attachmentToken({ contentType: "image/png", url: ATTACHMENT })).toBe(TokenCodec.encode(ATTACHMENT));
      expect(BridgeMedia.attachmentToken({ contentType: "video/mp4", url: ATTACHMENT })).toBeNull();
    });

    it("finds the GIF behind Discord's embeds of GIF picker links", () => {
      const klipy = {
        url: "https://klipy.com/gifs/cat-dance",
        video: { url: KLIPY_GIF.replace(".gif", ".mp4") },
        thumbnail: { url: KLIPY_GIF.replace(".gif", ".webp") }
      };
      expect(BridgeMedia.embedToken(klipy)).toBe(TokenCodec.encode(KLIPY_GIF));
      const tenor = {
        url: "https://tenor.com/view/x-12345",
        video: { url: "https://media.tenor.com/0_NdQQTvLpUAAAPo/x.mp4" },
        thumbnail: { url: "https://media.tenor.com/0_NdQQTvLpUAAAAe/x.png" }
      };
      expect(BridgeMedia.embedToken(tenor)).toBe(TokenCodec.encode("https://media.tenor.com/0_NdQQTvLpUAAAAC/tenor.gif"));
      const giphy = { url: "https://giphy.com/gifs/x", video: { url: "https://media.giphy.com/media/XJtM2nNFCzT3etvzOB/giphy.mp4" } };
      expect(BridgeMedia.embedToken(giphy)).toBe(TokenCodec.encode(GIPHY));
      expect(BridgeMedia.embedToken({ url: "https://example.com", thumbnail: { url: "https://example.com/x.png" } })).toBeNull();
    });

    it("reads tokens in Minecraft chat back as media, with expired Discord links marked", () => {
      const line = `Steve: ${TokenCodec.encode(GIPHY)} ${TokenCodec.encode(ATTACHMENT)} ${BridgeMedia.emojiToken("1000632669622767686", false)}`;
      const media = BridgeMedia.mediaInText(line, 1723400000); // the attachment link's ex is 1723353081
      expect(media.map((m) => [m.site, m.label, m.expired])).toEqual([
        ["giphy", "[▶ GIF]", false],
        ["discord", "[✉ Discord]", true],
        ["emoji", "[☺ Emoji]", false]
      ]);
      expect(media[0].url).toBe(GIPHY.replace("media.", "i."));
      expect(media[2].emoji).toEqual({ id: "1000632669622767686", animated: false });
      expect(BridgeMedia.replaceTokens(line, (m) => m.label)).toBe("Steve: [▶ GIF] [✉ Discord] [☺ Emoji]");
    });

    it("splits long messages at spaces without cutting a token", () => {
      const token = TokenCodec.encode(ATTACHMENT);
      const text = `${"word ".repeat(30)}${token} ${"more ".repeat(20)}${token}`;
      const parts = BridgeMedia.splitMessage(text, 200);
      expect(parts.join(" ")).toBe(text);
      expect(parts.every((p) => p.length <= 200)).toBe(true);
      expect(TokenCodec.findTokens(parts.join("\n")).length).toBe(2);
      expect(BridgeMedia.splitMessage("x".repeat(450), 200)).toEqual(["x".repeat(200), "x".repeat(200), "x".repeat(50)]);
    });
  });
});
