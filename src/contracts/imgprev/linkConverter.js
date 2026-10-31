// Port of ImgPrev's site/LinkConverter.java: image links in text → tokens. Most links convert on the spot;
// Postimages and ImgBB share page links are looked up first (their og:image), so the people reading them need
// nothing. Klipy page links can't be looked up at all and are left as they are.

const axios = require("axios");
const TokenCodec = require("./tokenCodec.js");
const { PAGES, isKlipyPageLink } = require("./sites.js");

const KLIPY_PAGE_LINK = "Klipy page links can't be converted. Right-click the GIF on the page and copy its image address instead.";
/** As Java's \S: only ASCII whitespace ends a link. */
const LINK = /https:\/\/[^ \t\n\v\f\r]+/gi;
const TRAILING = ".,!?;:)]}'\"";
const MAX_PAGE_BYTES = 1 << 20;
/** Both sites write property before content. */
const OG_IMAGE = /<meta\s+property="og:image"\s+content="([^"]+)"/;

/** A failure whose message can be shown as it is. */
class MediaError extends Error {}

/** Fetches a share page's HTML from exactly that address; tests stand in for the network. */
async function fetchPage(url) {
  const response = await axios.get(url, {
    responseType: "text",
    maxContentLength: MAX_PAGE_BYTES,
    maxRedirects: 0,
    timeout: 30000,
    headers: { "User-Agent": "hypixel-discord-chat-bridge (ImgPrev tokens)" },
    validateStatus: () => true
  });

  return { status: response.status, contentType: String(response.headers["content-type"] ?? ""), body: String(response.data) };
}

function page(url) {
  const u = TokenCodec.parseHttps(url);
  if (u === null) {
    return null;
  }

  for (const site of PAGES) {
    const id = site.pageId(u);
    if (id !== null) {
      return { site, id };
    }
  }

  return null;
}

/** True for links that can only become a token after a network lookup. */
function needsLookup(url) {
  const u = TokenCodec.parseHttps(url);
  return u !== null && (isKlipyPageLink(u) || page(url) !== null);
}

/** The page's full-size CDN address, only when it is an https address on the site's CDN. */
function ogImage(site, html) {
  const m = html.match(OG_IMAGE);
  const u = m ? TokenCodec.parseHttps(m[1]) : null;
  return u !== null && u.host === site.cdn && site.payloadFrom(u) !== null ? m[1] : null;
}

async function lookUp(site, id, fetcher) {
  let response;
  try {
    response = await fetcher(`https://${site.page}/${id}`);
  } catch (error) {
    throw new MediaError(`Couldn't look up the ${site.title} image`);
  }

  if (response.status === 404) {
    throw new MediaError(`${site.title} page not found`);
  }

  if (response.status !== 200 || !response.contentType.toLowerCase().startsWith("text/html")) {
    throw new MediaError(`Couldn't look up the ${site.title} image`);
  }

  const image = ogImage(site, response.body);
  if (image === null) {
    throw new MediaError(`No image found on that ${site.title} page`);
  }

  return image;
}

/**
 * @returns {Promise<string>} The token, or a rejected MediaError whose message can be shown as it is
 */
async function convert(url, fetcher = fetchPage) {
  const direct = TokenCodec.encode(url);
  if (direct !== null) {
    return direct;
  }

  const u = TokenCodec.parseHttps(url);
  if (u !== null && isKlipyPageLink(u)) {
    throw new MediaError(KLIPY_PAGE_LINK);
  }

  const p = page(url);
  if (p === null) {
    throw new MediaError("Not a supported image link");
  }

  const token = TokenCodec.encode(await lookUp(p.site, p.id, fetcher));
  if (token === null) {
    throw new MediaError(`${p.site.title} returned an address ImgPrev can't use`);
  }

  return token;
}

function trimTrailing(url) {
  let end = url.length;
  while (end > 0 && TRAILING.includes(url[end - 1])) {
    end--;
  }

  return url.slice(0, end);
}

/**
 * Replaces each https link that tokens(url) has a token for; links without one stay as typed. Punctuation right
 * after a link ("…png).") is tried as sentence punctuation first, since some sites' paths would accept it.
 */
function replaceLinks(text, tokens) {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    let url = m[0];
    const trimmed = trimTrailing(url);
    let token = trimmed.length < url.length ? tokens(trimmed) : null;
    if (token !== null) {
      url = trimmed;
    } else {
      token = tokens(url);
    }

    if (token === null) {
      continue;
    }

    out += text.slice(last, m.index) + token;
    last = m.index + url.length;
  }

  return out + text.slice(last);
}

/** text with every link that converts without a lookup replaced by its token. */
function convertNow(text) {
  return replaceLinks(text, TokenCodec.encode);
}

/** Page links in text, which convertNow leaves alone; each once, in order. */
function lookupsIn(text) {
  const out = new Set();
  for (const [url] of text.matchAll(LINK)) {
    const trimmed = trimTrailing(url);
    if (needsLookup(trimmed)) {
      out.add(trimmed);
    } else if (needsLookup(url)) {
      out.add(url);
    }
  }

  return [...out];
}

/**
 * Converts every link in text, looking up page links first. Unlike the mod, which refuses to send a message whose
 * lookup failed, a link that can't be looked up is relayed as it was typed.
 */
async function convertAll(text, fetcher = fetchPage) {
  const found = new Map();
  await Promise.all(
    lookupsIn(text).map(async (url) => {
      try {
        found.set(url, await convert(url, fetcher));
      } catch (error) {
        // left as the link
      }
    })
  );

  return replaceLinks(text, (url) => found.get(url) ?? TokenCodec.encode(url));
}

module.exports = { KLIPY_PAGE_LINK, LINK, MediaError, needsLookup, convert, convertNow, convertAll, lookupsIn, replaceLinks, trimTrailing, ogImage };
