// Keeps links out of Minecraft chat: anything that looks like a link becomes "[link]", except links to Hypixel's own
// sites. Run after image links have become ImgPrev tokens, which contain no links.

const ALLOWED_DOMAINS = ["hypixel.net"];

// Endings that make a bare word.word a link. Short ones that are also common words (to, me, us) are included on
// purpose: a missed link costs more than a mangled word.
const TLDS = "com|net|org|gg|io|tv|xyz|info|dev|app|link|ly|gl|cc|co|me|to|us|uk|de|ru|fr|eu|ca|au|nl|br|pl|jp|cn|biz|site|online|store|shop|top|club|fun|live|win|ws|sh|gd|tk|ml|ga|cf|gq|pw|vip|lol|ink|page|cloud|pro|name|mobi|asia|cx|is|it|be|ch|se|no|fi|dk|es|pt|at|cz|ua|kr|tw|hk|sg|in|id|mx|ar|tr|ir|za|nz";

/** A link with a scheme, or a bare domain (optionally www.) with a path; sentence punctuation after it stays outside. */
const LINK = new RegExp(
  String.raw`https?:\/\/\S*[^\s.,!?;:)\]}'"]|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${TLDS})\b(?::\d+)?(?:\/\S*[^\s.,!?;:)\]}'"])?`,
  "gi"
);

function hostOf(link) {
  try {
    return new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.toLowerCase();
  } catch (error) {
    return null;
  }
}

function isAllowed(link) {
  const host = hostOf(link);
  return host !== null && ALLOWED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** text with every link that isn't to Hypixel replaced by "[link]". */
function blockLinks(text) {
  return text.replace(LINK, (link) => (isAllowed(link) ? link : "[link]"));
}

module.exports = { ALLOWED_DOMAINS, blockLinks };
