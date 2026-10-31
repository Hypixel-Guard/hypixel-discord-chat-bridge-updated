// Port of ImgPrev's site/*Codec.java and SiteRegistry.java: what each image site's links and token payloads look
// like. Keep in step with the mod; tests/imgprev.test.js checks every link in the mod's corpus against its tokens.

const Base62 = require("./base62.js");
const Mixed = require("./mixed.js");

/** What tokens show as in Minecraft chat, as the mod draws them. */
const Label = {
  GIF: { text: "GIF", icon: "▶" },
  IMAGE: { text: "Image", icon: "⧈" },
  EMOJI: { text: "Emoji", icon: "☺" },
  STICKER: { text: "Sticker", icon: "★" },
  DISCORD: { text: "Discord", icon: "✉" }
};

/** "[▶ GIF]" */
function labelText(label) {
  return `[${label.icon} ${label.text}]`;
}

/** Case-insensitive alternatives for one part of a pattern, as Java's (?i:gif|png) (Node 20 has no inline flags). */
function anyCase(...words) {
  return words.map((word) => word.replace(/[a-z]/g, (c) => `[${c}${c.toUpperCase()}]`)).join("|");
}

/** Java's String.split: trailing empty strings are dropped. */
function javaSplit(s, separator) {
  const parts = s.split(separator);
  while (parts.length > 1 && parts[parts.length - 1] === "") {
    parts.pop();
  }

  return parts;
}

/** Query parameters as Java's URLDecoder reads them; the first of a repeated name wins. */
function query(raw) {
  const out = new Map();
  if (raw === null || raw === undefined) {
    return out;
  }

  for (const part of raw.split("&")) {
    const eq = part.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    try {
      const decode = (s) => decodeURIComponent(s.replace(/\+/g, " "));
      const name = decode(part.slice(0, eq));
      if (!out.has(name)) {
        out.set(name, decode(part.slice(eq + 1)));
      }
    } catch (error) {
      // malformed %-escape: skip the pair
    }
  }

  return out;
}

function hex(s, length) {
  return typeof s === "string" && s.length === length && /^[0-9a-f]+$/.test(s);
}

/** @returns {bigint} */
function fromRadix(digits, radix) {
  return radix === 16 ? BigInt(`0x${digits}`) : BigInt(digits);
}

const SNOWFLAKE = /^\d{15,21}$/;

/**
 * A site codec, as the mod's SiteCodec interface. payloadFrom takes { host, path, rawQuery } and returns the payload
 * or null; compact/expand are the token v2 form (default: the payload itself).
 */
function codec(fields) {
  return {
    siteName: fields.title,
    expiresAtEpochSec: () => null,
    compact: (payload) => payload,
    expand: (compact) => compact,
    ...fields
  };
}

const giphy = codec({
  code: "g",
  name: "giphy",
  title: "Giphy",
  label: Label.GIF,
  acceptedHosts: new Set([
    "giphy.com",
    "i.giphy.com",
    "media.giphy.com",
    "media0.giphy.com",
    "media1.giphy.com",
    "media2.giphy.com",
    "media3.giphy.com",
    "media4.giphy.com"
  ]),
  allowedDownloadHosts: new Set(["i.giphy.com"]),
  payloadPattern: /^[A-Za-z0-9]{5,40}$/,
  payloadFrom(u) {
    const ID = /^[A-Za-z0-9]{5,40}$/;
    const seg = javaSplit(u.path, "/");
    // i.giphy.com/{id}.gif
    if (u.host === "i.giphy.com" && seg.length === 2) {
      const m = seg[1].match(new RegExp(`^([A-Za-z0-9]{5,40})\\.(?:${anyCase("gif", "webp")})$`));
      return m ? m[1] : null;
    }

    // giphy.com/gifs/{slug-}{id}
    if (u.host === "giphy.com" && seg.length >= 3 && seg[1] === "gifs") {
      const id = seg[2].slice(seg[2].lastIndexOf("-") + 1);
      return ID.test(id) ? id : null;
    }

    // media*.giphy.com/media/[v1.xxx/]{id}/giphy.gif
    if (seg.length >= 4 && seg[1] === "media") {
      const id = seg[seg.length - 2];
      return ID.test(id) ? id : null;
    }

    return null;
  },
  mediaUri: (id) => `https://i.giphy.com/media/${id}/giphy.gif`
});

const imgur = codec({
  code: "i",
  name: "imgur",
  title: "Imgur",
  label: Label.IMAGE,
  acceptedHosts: new Set(["imgur.com", "i.imgur.com"]),
  allowedDownloadHosts: new Set(["i.imgur.com"]),
  payloadPattern: /^[pjg][A-Za-z0-9]{5,7}$/,
  payloadFrom(u) {
    if (u.path.startsWith("/a/") || u.path.startsWith("/gallery/")) {
      return null;
    }

    const m = u.path.match(new RegExp(`^/([A-Za-z0-9]{5,7})(?:\\.(${anyCase("png", "jpg", "jpeg", "gif", "gifv", "webp", "mp4")}))?$`));
    if (!m) {
      return null;
    }

    const ext = m[2] === undefined ? "png" : m[2].toLowerCase();
    const e = ext.startsWith("gif") || ext === "mp4" ? "g" : ext.startsWith("jp") ? "j" : "p";
    return e + m[1];
  },
  mediaUri(p) {
    const ext = { g: "gif", j: "jpg" }[p[0]] ?? "png";
    return `https://i.imgur.com/${p.slice(1)}.${ext}`;
  }
});

// Tenor: a media key is base64url of 12 bytes, an 8-byte post id then a 4-byte rendition code (2 = full-size GIF).
// Senders' keys are rewritten to the full-size GIF, so a token carries just the post id.
const TENOR_KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** @returns {bigint | null} The post id of a standard 16-character key. */
function tenorPostId(key) {
  if (key.length !== 16) {
    return null;
  }

  const b = Buffer.from(key, "base64url");
  return b.length === 12 && b[8] === 0 && b[9] === 0 && b[10] === 0 ? b.readBigUInt64BE(0) : null;
}

function tenorFullGif(id) {
  const b = Buffer.alloc(12);
  b.writeBigUInt64BE(BigInt.asUintN(64, id), 0);
  b[11] = 2;
  return b.toString("base64url");
}

const tenor = codec({
  code: "t",
  name: "tenor",
  title: "Tenor",
  label: Label.GIF,
  acceptedHosts: new Set(["media.tenor.com", "media1.tenor.com", "c.tenor.com"]),
  allowedDownloadHosts: new Set(["media.tenor.com"]),
  payloadPattern: /^[A-Za-z0-9_-]{8,32}$/,
  payloadFrom(u) {
    const m = u.path.match(new RegExp(`^(?:/[mM])?/([A-Za-z0-9_-]{8,32})/[^/]+\\.(?:${anyCase("gif")})$`));
    if (!m) {
      return null;
    }

    const id = tenorPostId(m[1]);
    return id === null ? m[1] : tenorFullGif(id);
  },
  /** Flag 0: a full-size GIF key as its post id. Flag 1: any other key, character by character. */
  compact(key) {
    const id = tenorPostId(key);
    const m = id !== null && tenorFullGif(id) === key ? new Mixed().putBits(id, 64).put(0, 2) : new Mixed().putString(key, TENOR_KEY_CHARS, 8, 32).put(1, 2);
    return m.toBase62();
  },
  expand(s) {
    const m = Mixed.fromBase62(s);
    if (m === null) {
      return null;
    }

    const key = m.take(2) === 0 ? tenorFullGif(m.takeBits(64)) : m.takeString(TENOR_KEY_CHARS, 8, 32);
    return m.isEmpty() ? key : null;
  },
  /** Tenor ignores the filename; the key's suffix selects the rendition, and medium GIFs are swapped for full-size ones. */
  mediaUri(key) {
    const full = key.endsWith("AAAAM") ? `${key.slice(0, -5)}AAAAC` : key;
    return `https://media.tenor.com/${full}/tenor.gif`;
  }
});

/** a|s (animated/static) or g|p (GIF/other) + Base62(snowflake), packed as the snowflake and the flag. */
function snowflakeCodec(flagged) {
  return {
    compact: (p) =>
      new Mixed()
        .putBits(Base62.decode(p.slice(1)), 64)
        .put(p[0] === flagged[1] ? 1 : 0, 2)
        .toBase62(),
    expand(s) {
      const m = Mixed.fromBase62(s);
      if (m === null) {
        return null;
      }

      const kind = m.take(2) === 1 ? flagged[1] : flagged[0];
      const id = Base62.encode(m.takeBits(64));
      return m.isEmpty() ? kind + id : null;
    }
  };
}

/** Discord emoji: unsigned, never expire. */
const emoji = codec({
  code: "e",
  name: "emoji",
  title: "Discord emoji",
  siteName: "Discord",
  label: Label.EMOJI,
  acceptedHosts: new Set(["cdn.discordapp.com", "media.discordapp.net"]),
  allowedDownloadHosts: new Set(["cdn.discordapp.com"]),
  payloadPattern: /^[as][0-9A-Za-z]{1,11}$/,
  payloadFrom(u) {
    const m = u.path.match(new RegExp(`^/emojis/(\\d{15,21})\\.(${anyCase("gif", "png", "webp")})$`));
    if (!m) {
      return null;
    }

    // The Discord client links animated emoji as .webp?animated=true.
    const animated = m[2].toLowerCase() === "gif" || query(u.rawQuery).get("animated") === "true";
    return (animated ? "a" : "s") + Base62.encode(BigInt(m[1]));
  },
  ...snowflakeCodec("sa"),
  mediaUri(p) {
    const id = Base62.decode(p.slice(1)).toString();
    if (!SNOWFLAKE.test(id)) {
      throw new Error("snowflake");
    }

    return `https://cdn.discordapp.com/emojis/${id}.${p[0] === "a" ? "gif" : "png"}?size=128`;
  }
});

// Discord attachments: signed links (ex/is 8 hex, hm 64 hex), which expire after about 24 hours.
const DEFAULT_NAMES = ["image.png", "unknown.png"];
const EXTS = ["png", "jpg", "gif", "PNG", "jpeg", "webp", "JPG", "mp4"];
const NAME_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz._-";
const LIFETIMES = [86400n, 1209600n];
const IS_EPOCH = 1600000000n;

function safeName(n) {
  return /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/.test(n) && !n.includes("..");
}

/** A leading 0x01 byte keeps leading NULs/digits from vanishing in the number. */
function nameEnc(n) {
  return Base62.encode(BigInt(`0x01${Buffer.from(n, "latin1").toString("hex")}`));
}

/** As Java's BigInteger.toByteArray: the shortest two's complement bytes. */
function nameDec(s) {
  let h = Base62.decode(s).toString(16);
  if (h.length % 2 === 1) {
    h = `0${h}`;
  }

  if (parseInt(h[0], 16) >= 8) {
    h = `00${h}`;
  }

  const w = Buffer.from(h, "hex");
  return w.length < 2 || w[0] !== 1 ? null : w.subarray(1).toString("latin1");
}

function b62(digits, radix) {
  return Base62.encode(fromRadix(digits, radix));
}

function dec(s, radix, pad) {
  const out = Base62.decode(s).toString(radix);
  return pad > 0 ? Base62.leftPad(out, pad) : out;
}

const discord = codec({
  code: "d",
  name: "discord",
  title: "Discord attachments",
  siteName: "Discord",
  label: Label.DISCORD,
  acceptedHosts: new Set(["cdn.discordapp.com", "media.discordapp.net"]),
  allowedDownloadHosts: new Set(["cdn.discordapp.com", "media.discordapp.net"]),
  payloadPattern: /^([0-9A-Za-z]+-){5}[0-9A-Za-z]+$/,
  payloadFrom(u) {
    const m = u.path.match(/^\/attachments\/(\d{15,21})\/(\d{15,21})\/([A-Za-z0-9._-]{1,100})$/);
    if (!m || !safeName(m[3])) {
      return null;
    }

    const q = query(u.rawQuery);
    const [ex, is, hm] = [q.get("ex"), q.get("is"), q.get("hm")];
    if (!hex(ex, 8) || !hex(is, 8) || !hex(hm, 64)) {
      return null;
    }

    return [b62(m[1], 10), b62(m[2], 10), b62(ex, 16), b62(is, 16), b62(hm, 16), nameEnc(m[3])].join("-");
  },
  /** Always rebuilt on cdn.discordapp.com, whichever host the sender copied from. */
  mediaUri(p) {
    const f = p.split("-");
    const [ch, att, ex, is, hm] = [dec(f[0], 10, 0), dec(f[1], 10, 0), dec(f[2], 16, 8), dec(f[3], 16, 8), dec(f[4], 16, 64)];
    if (!SNOWFLAKE.test(ch) || !SNOWFLAKE.test(att) || !hex(ex, 8) || !hex(is, 8) || !hex(hm, 64)) {
      throw new Error("payload");
    }

    const name = nameDec(f[5]);
    if (name === null || !safeName(name)) {
      throw new Error("name");
    }

    return `https://cdn.discordapp.com/attachments/${ch}/${att}/${name}?ex=${ex}&is=${is}&hm=${hm}&`;
  },
  expiresAtEpochSec: (p) => Number(Base62.decode(p.split("-")[2])),
  /**
   * One number: the two snowflakes, `is` since 2020, `ex` as a lifetime when it's a usual one, `hm`, then the
   * filename (Discord's default names as one symbol, else the name with a common extension split off).
   */
  compact(p) {
    const f = p.split("-");
    const name = nameDec(f[5]);
    if (name === null) {
      throw new Error("name");
    }

    const ex = Base62.decode(f[2]);
    const is = Base62.decode(f[3]);
    const m = new Mixed();
    const known = DEFAULT_NAMES.indexOf(name);
    if (known < 0) {
      const dot = name.lastIndexOf(".");
      const ext = dot > 0 ? EXTS.indexOf(name.slice(dot + 1)) : -1;
      m.putString(ext < 0 ? name : name.slice(0, dot), NAME_CHARS, 1, 100).put(ext < 0 ? EXTS.length : ext, EXTS.length + 1);
    }

    m.put(known < 0 ? DEFAULT_NAMES.length : known, DEFAULT_NAMES.length + 1).putBits(Base62.decode(f[4]), 256);
    const life = LIFETIMES.indexOf(ex - is);
    if (life < 0) {
      m.putBits(ex, 32);
    }

    return m
      .put(life < 0 ? LIFETIMES.length : life, LIFETIMES.length + 1)
      .putBits(is - IS_EPOCH, 31)
      .putBits(Base62.decode(f[1]), 63)
      .putBits(Base62.decode(f[0]), 63)
      .toBase62();
  },
  expand(s) {
    const m = Mixed.fromBase62(s);
    if (m === null) {
      return null;
    }

    const ch = m.takeBits(63);
    const att = m.takeBits(63);
    const is = m.takeBits(31) + IS_EPOCH;
    const life = m.take(LIFETIMES.length + 1);
    const ex = life < LIFETIMES.length ? is + LIFETIMES[life] : m.takeBits(32);
    const hm = m.takeBits(256);
    const known = m.take(DEFAULT_NAMES.length + 1);
    let name;
    if (known < DEFAULT_NAMES.length) {
      name = DEFAULT_NAMES[known];
    } else {
      const ext = m.take(EXTS.length + 1);
      const base = m.takeString(NAME_CHARS, 1, 100);
      name = ext < EXTS.length ? `${base}.${EXTS[ext]}` : base;
    }

    if (!m.isEmpty() || !safeName(name)) {
      return null;
    }

    return [ch, att, ex, is, hm].map((n) => Base62.encode(n)).join("-") + "-" + nameEnc(name);
  },
  expiredMessage: "Discord link expired"
});

/**
 * Discord stickers: unsigned, never expire. PNG and APNG stickers are both .png (the .webp rendition is a still);
 * GIF stickers are only served from media.discordapp.net. Lottie stickers are JSON, with no image to preview.
 */
const sticker = codec({
  code: "s",
  name: "sticker",
  title: "Discord stickers",
  siteName: "Discord",
  label: Label.STICKER,
  acceptedHosts: new Set(["media.discordapp.net", "cdn.discordapp.com"]),
  allowedDownloadHosts: new Set(["media.discordapp.net"]),
  payloadPattern: /^[gp][0-9A-Za-z]{1,11}$/,
  payloadFrom(u) {
    const m = u.path.match(new RegExp(`^/stickers/(\\d{15,21})\\.(${anyCase("gif", "png", "webp")})$`));
    return m ? (m[2].toLowerCase() === "gif" ? "g" : "p") + Base62.encode(BigInt(m[1])) : null;
  },
  ...snowflakeCodec("pg"),
  mediaUri(p) {
    const id = Base62.decode(p.slice(1)).toString();
    if (!SNOWFLAKE.test(id)) {
      throw new Error("snowflake");
    }

    return `https://media.discordapp.net/stickers/${id}.${p[0] === "g" ? "gif" : "png"}?size=320`;
  }
});

/** Payload: ext code p|j|g + Base62(32-hex id); page links without an extension assume png. */
const gyazo = codec({
  code: "z",
  name: "gyazo",
  title: "Gyazo",
  label: Label.IMAGE,
  acceptedHosts: new Set(["gyazo.com", "i.gyazo.com"]),
  allowedDownloadHosts: new Set(["i.gyazo.com"]),
  payloadPattern: /^[pjg][0-9A-Za-z]{1,22}$/,
  payloadFrom(u) {
    const m = u.path.match(new RegExp(`^/([0-9a-fA-F]{32})(?:\\.(${anyCase("png", "jpg", "jpeg", "gif")}))?$`));
    if (!m) {
      return null;
    }

    const ext = m[2] === undefined ? "png" : m[2].toLowerCase();
    const e = ext.startsWith("jp") ? "j" : ext === "gif" ? "g" : "p";
    return e + Base62.encode(BigInt(`0x${m[1]}`));
  },
  compact: (p) =>
    new Mixed()
      .putBits(Base62.decode(p.slice(1)), 128)
      .put("pjg".indexOf(p[0]), 3)
      .toBase62(),
  expand(s) {
    const m = Mixed.fromBase62(s);
    if (m === null) {
      return null;
    }

    const ext = "pjg"[m.take(3)];
    const id = Base62.encode(m.takeBits(128));
    return m.isEmpty() ? ext + id : null;
  },
  mediaUri(p) {
    const h = Base62.decode(p.slice(1)).toString(16);
    if (h.length > 32) {
      throw new Error("id");
    }

    const ext = { j: "jpg", g: "gif" }[p[0]] ?? "png";
    return `https://i.gyazo.com/${Base62.leftPad(h, 32)}.${ext}`;
  }
});

/** Klipy CDN addresses, static.klipy.com/ii/{32 hex}/{2 hex}/{2 hex}/{name}.{ext}. Page links need Klipy's API. */
const KLIPY_EXT = "gwpj";
const klipy = codec({
  code: "y",
  name: "klipy",
  title: "Klipy",
  label: Label.GIF,
  acceptedHosts: new Set(["static.klipy.com", "static1.klipy.com", "static2.klipy.com"]),
  allowedDownloadHosts: new Set(["static.klipy.com", "static2.klipy.com"]),
  payloadPattern: /^[gwpj][0-9A-Za-z]{1,22}-[0-9A-Za-z]{1,3}-[A-Za-z0-9]{4,32}$/,
  payloadFrom(u) {
    const m = u.path.match(new RegExp(`^/ii/([0-9a-f]{32})/([0-9a-f]{2})/([0-9a-f]{2})/([A-Za-z0-9]{4,32})\\.(${anyCase("gif", "webp", "png", "jpg", "jpeg")})$`));
    if (!m) {
      return null;
    }

    const e = { gif: "g", webp: "w", png: "p" }[m[5].toLowerCase()] ?? "j";
    return `${e}${Base62.encode(BigInt(`0x${m[1]}`))}-${Base62.encode(BigInt(`0x${m[2]}${m[3]}`))}-${m[4]}`;
  },
  compact(p) {
    const f = p.slice(1).split("-");
    return new Mixed()
      .putString(f[2], Base62.A, 4, 32)
      .putBits(Base62.decode(f[1]), 16)
      .putBits(Base62.decode(f[0]), 128)
      .put(KLIPY_EXT.indexOf(p[0]), KLIPY_EXT.length)
      .toBase62();
  },
  expand(s) {
    const m = Mixed.fromBase62(s);
    if (m === null) {
      return null;
    }

    const ext = KLIPY_EXT[m.take(KLIPY_EXT.length)];
    const hash = Base62.encode(m.takeBits(128));
    const dirs = Base62.encode(m.takeBits(16));
    const name = m.takeString(Base62.A, 4, 32);
    return m.isEmpty() ? `${ext}${hash}-${dirs}-${name}` : null;
  },
  mediaUri(p) {
    const f = p.slice(1).split("-");
    let hash = Base62.decode(f[0]).toString(16);
    let dirs = Base62.decode(f[1]).toString(16);
    if (hash.length > 32 || dirs.length > 4) {
      throw new Error("payload");
    }

    hash = Base62.leftPad(hash, 32);
    dirs = Base62.leftPad(dirs, 4);
    const ext = { g: "gif", w: "webp", p: "png" }[p[0]] ?? "jpg";
    return `https://static.klipy.com/ii/${hash}/${dirs.slice(0, 2)}/${dirs.slice(2)}/${f[2]}.${ext}`;
  }
});

/** klipy.com/gifs page links, which can't become tokens: only Klipy's API (with a key) knows their GIF. */
function isKlipyPageLink(u) {
  return ["klipy.com", "www.klipy.com"].includes(u.host) && /^\/gifs\/[A-Za-z0-9-]{3,100}\/?$/.test(u.path);
}

/**
 * Hosts whose CDN addresses are {cdn}/{id}/{filename} and serve the file by id alone (Postimages, ImgBB). Their
 * share pages, {page}/{id}, use a different id, which linkConverter.js looks up from the page's og:image.
 */
function idPathCodec(code, name, title, cdn, page) {
  return codec({
    code,
    name,
    title,
    label: Label.IMAGE,
    acceptedHosts: new Set([cdn]),
    allowedDownloadHosts: new Set([cdn]),
    payloadPattern: /^[A-Za-z0-9]{6,12}$/,
    payloadFrom(u) {
      const m = u.path.match(/^\/([A-Za-z0-9]{6,12})\/[^/]+$/);
      return m ? m[1] : null;
    },
    mediaUri: (id) => `https://${cdn}/${id}/image.png`,
    cdn,
    page,
    /** The id of a share page link; www. and a trailing slash only redirect. */
    pageId(u) {
      if (u.host !== page && u.host !== `www.${page}`) {
        return null;
      }

      const m = u.path.match(/^\/([A-Za-z0-9]{6,12})\/?$/);
      return m ? m[1] : null;
    }
  });
}

const postimages = idPathCodec("p", "postimages", "Postimages", "i.postimg.cc", "postimg.cc");
const imgbb = idPathCodec("b", "imgbb", "ImgBB", "i.ibb.co", "ibb.co");

const catbox = codec({
  code: "c",
  name: "catbox",
  title: "Catbox",
  label: Label.IMAGE,
  acceptedHosts: new Set(["files.catbox.moe"]),
  allowedDownloadHosts: new Set(["files.catbox.moe"]),
  payloadPattern: /^[pjegw][a-z0-9]{6}$/,
  payloadFrom(u) {
    const m = u.path.match(/^\/([a-z0-9]{6})\.(png|jpg|jpeg|gif|webp)$/);
    return m ? { png: "p", jpg: "j", jpeg: "e", gif: "g", webp: "w" }[m[2]] + m[1] : null;
  },
  compact: (p) => new Mixed().putString(p.slice(1), "0123456789abcdefghijklmnopqrstuvwxyz", 6, 6).put("pjegw".indexOf(p[0]), 5).toBase62(),
  expand(s) {
    const m = Mixed.fromBase62(s);
    if (m === null) {
      return null;
    }

    const ext = "pjegw"[m.take(5)];
    const id = m.takeString("0123456789abcdefghijklmnopqrstuvwxyz", 6, 6);
    return m.isEmpty() ? ext + id : null;
  },
  mediaUri(p) {
    const ext = { p: "png", j: "jpg", e: "jpeg", g: "gif" }[p[0]] ?? "webp";
    return `https://files.catbox.moe/${p.slice(1)}.${ext}`;
  }
});

/** In the mod's order, so hosts shared by several codecs (Discord) try them the same way. */
const ALL = [giphy, imgur, tenor, emoji, discord, sticker, gyazo, klipy, postimages, imgbb, catbox];
const PAGES = [postimages, imgbb];

/** Every codec accepting this (lowercase) host; more than one may match. */
function byHost(host) {
  return ALL.filter((c) => c.acceptedHosts.has(host));
}

function byCode(code) {
  return ALL.find((c) => c.code === code) ?? null;
}

module.exports = { Label, labelText, ALL, PAGES, byHost, byCode, isKlipyPageLink, query };
