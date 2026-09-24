// @ts-ignore
const { get } = require("axios");

// Cheap authenticated endpoint used purely to probe whether Hypixel's API is reachable and accepting the bot's key.
const VALIDATION_ENDPOINT = "https://api.hypixel.net/v2/punishmentstats";

/**
 * @typedef {"valid" | "invalid" | "rate-limited" | "unavailable"} ApiKeyStatus
 */

/**
 * Checks the current status of Hypixel's API using the bot's key.
 * @param {string} apiKey
 * @param {number} timeoutMs Request timeout.
 * @returns {Promise<{ status: ApiKeyStatus, message: string }>}
 */
async function checkApiKeyStatus(apiKey, timeoutMs = 10000) {
  try {
    await get(VALIDATION_ENDPOINT, {
      headers: { "API-Key": apiKey },
      timeout: timeoutMs
    });

    return { status: "valid", message: "Hypixel's API is online and the bot's key is being accepted." };
  } catch (error) {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      return { status: "invalid", message: `Hypixel rejected the bot's API key (HTTP ${status}), so player and guild data cannot be fetched right now.` };
    }

    if (status === 429) {
      return { status: "rate-limited", message: "Hypixel is currently rate-limiting the bot (HTTP 429). This usually clears within a few minutes." };
    }

    if (status >= 500) {
      return { status: "unavailable", message: `Hypixel's API is returning server errors (HTTP ${status}). This is on Hypixel's side; please try again later.` };
    }

    if (error?.code === "ECONNABORTED") {
      return { status: "unavailable", message: "Hypixel's API did not respond in time. It may be down or under heavy load; please try again later." };
    }

    return { status: "unavailable", message: "Could not reach Hypixel's API. It may be down or there may be a network issue; please try again later." };
  }
}

module.exports = { checkApiKeyStatus };
