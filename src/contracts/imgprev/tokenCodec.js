// Port of ImgPrev's token/TokenCodec.java: image links ↔ the <~…~> tokens the ImgPrev mod previews in Minecraft chat.
//
// Tokens are "<~" header payload check "~>". Version 2 (sent): the header is the site code in upper case and the
// payload is the site's compact form, Base62 only. Version 1 (still read): the header is "1" plus the lower-case site
// code, and the payload is the site's payload as-is.

const { crc32 } = require("zlib");
const Base62 = require("./base62.js");
const { byHost, byCode } = require("./sites.js");

const TOKEN = /<~([0-9]?)([A-Za-z])([A-Za-z0-9-]{1,200})([0-9A-Za-z])~>/;
const V2_PAYLOAD = /^[A-Za-z0-9]+$/;
const MAX_PAYLOAD = 200;
/** Characters Java's URI refuses, which WHATWG URL would quietly escape instead. */
const NOT_URI = /[\s<>"{}|\\^`[\]]/;

/**
 * An https link as { host, path, rawQuery }, read the way the mod's java.net.URI does: host in lower case, path with
 * %-escapes decoded, query raw (null when there is none). Null for anything else.
 */
function parseHttps(url) {
  if (typeof url !== "string" || !/^https:\/\//i.test(url) || NOT_URI.test(url)) {
    return null;
  }

  try {
    const u = new URL(url);
    if (u.hostname === "") {
      return null;
    }

    const at = url.indexOf("?");
    const hash = url.indexOf("#");
    const rawQuery = at < 0 || (hash >= 0 && hash < at) ? null : url.slice(at + 1, hash > at ? hash : undefined);
    return { host: u.hostname.toLowerCase(), path: decodeURIComponent(u.pathname), rawQuery };
  } catch (error) {
    return null;
  }
}

function check(body) {
  return Base62.A[crc32(Buffer.from(body, "ascii")) % 62];
}

/** The token v2 form of a payload, or null when it's too long or doesn't survive the trip back. */
function compact(codec, payload) {
  try {
    const s = codec.compact(payload);
    return s.length <= MAX_PAYLOAD && V2_PAYLOAD.test(s) && expand(codec, s) === payload ? s : null;
  } catch (error) {
    return null;
  }
}

/** Hand-made payloads can be any Base62 text, so a codec that throws on one just doesn't decode it. */
function expand(codec, s) {
  try {
    return codec.expand(s);
  } catch (error) {
    return null;
  }
}

/**
 * @param {string} url
 * @returns {string | null} The token for an image link on a supported site
 */
function encode(url) {
  const u = parseHttps(url);
  if (u === null) {
    return null;
  }

  // Several codecs can share a host (Discord emoji, stickers and attachments), so try each until one accepts the path.
  for (const codec of byHost(u.host)) {
    const payload = codec.payloadFrom(u);
    if (payload === null || !codec.payloadPattern.test(payload)) {
      continue;
    }

    const c = compact(codec, payload);
    if (c !== null) {
      const body = codec.code.toUpperCase() + c;
      return `<~${body}${check(body)}~>`;
    }
  }

  return null;
}

/**
 * What a token refers to. Never derives a host from token content.
 * @param {string} token
 * @returns {{ codec: object, payload: string, key: string } | null}
 */
function decode(token) {
  const m = typeof token === "string" ? token.match(new RegExp(`^${TOKEN.source}$`)) : null;
  return m ? decodeMatch(m) : null;
}

function decodeMatch(m) {
  const [, ver, site, payload, sum] = m;
  if (check(ver + site + payload) !== sum) {
    return null;
  }

  const v1 = ver === "1" && site === site.toLowerCase();
  const v2 = ver === "" && site === site.toUpperCase() && V2_PAYLOAD.test(payload);
  const codec = v1 || v2 ? byCode(site.toLowerCase()) : null;
  if (codec === null) {
    return null;
  }

  const p = v1 ? payload : expand(codec, payload);
  return p !== null && codec.payloadPattern.test(p) ? { codec, payload: p, key: codec.code + p } : null;
}

/**
 * Every token in text that decodes, in order.
 * @returns {{ token: string, index: number, codec: object, payload: string, key: string }[]}
 */
function findTokens(text) {
  const out = [];
  for (const m of String(text).matchAll(new RegExp(TOKEN.source, "g"))) {
    const media = decodeMatch(m);
    if (media !== null) {
      out.push({ token: m[0], index: m.index, ...media });
    }
  }

  return out;
}

module.exports = { TOKEN, MAX_PAYLOAD, parseHttps, check, encode, decode, findTokens };
