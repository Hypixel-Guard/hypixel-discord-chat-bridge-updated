// Lets a Minecraft command control how its own guild-chat echoes are relayed to Discord.
// A command that has to split a long reply into several chat messages registers each chunk here:
// the first chunk maps to the full text (so Discord receives it in one piece) and the remaining
// chunks map to null (so Discord doesn't receive them again). The ChatHandler consumes entries
// as the bot's echoes come back in.

const TTL = 60 * 1000;

/** @type {Map<string, { relayAs: string | null, registeredAt: number }>} */
const overrides = new Map();

function prune() {
  const now = Date.now();
  for (const [chunk, entry] of overrides) {
    if (now - entry.registeredAt > TTL) {
      overrides.delete(chunk);
    }
  }
}

/**
 * @param {string} chunk - The exact text sent to Minecraft chat
 * @param {string | null} relayAs - Text to relay to Discord instead, or null to relay nothing
 */
function registerRelayOverride(chunk, relayAs) {
  prune();
  overrides.set(chunk, { relayAs, registeredAt: Date.now() });
}

/**
 * @param {string} chunk - The message text as it came back from the bot's own guild chat
 * @returns {string | null | undefined} Replacement text, null to skip relaying, or undefined if no override exists
 */
function consumeRelayOverride(chunk) {
  const entry = overrides.get(chunk);
  if (entry === undefined) {
    return undefined;
  }

  overrides.delete(chunk);
  return entry.relayAs;
}

module.exports = { registerRelayOverride, consumeRelayOverride };
