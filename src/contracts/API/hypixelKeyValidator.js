// @ts-ignore
const { get } = require("axios");

// Cheap authenticated endpoint used purely to probe whether a key is accepted by Hypixel.
const VALIDATION_ENDPOINT = "https://api.hypixel.net/v2/punishmentstats";

/**
 * @typedef {"valid" | "invalid" | "rate-limited" | "unavailable"} ApiKeyStatus
 */

/**
 * Checks whether a Hypixel API key is currently accepted by Hypixel's API.
 * @param {string} apiKey
 * @param {number} timeoutMs Request timeout. Keep this well under Discord's ~3s interaction ack window for any caller that hasn't deferred yet.
 * @returns {Promise<{ status: ApiKeyStatus, message: string }>}
 */
async function checkApiKeyStatus(apiKey, timeoutMs = 10000) {
  try {
    await get(VALIDATION_ENDPOINT, {
      headers: { "API-Key": apiKey },
      timeout: timeoutMs
    });

    return { status: "valid", message: "The Hypixel API key is working correctly." };
  } catch (error) {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      return { status: "invalid", message: "The Hypixel API key is invalid or has been revoked." };
    }

    if (status === 429) {
      return { status: "rate-limited", message: "Hypixel is currently rate-limiting this key. Please try again later." };
    }

    if (status >= 500) {
      return { status: "unavailable", message: "Hypixel's API appears to be down. Please try again later." };
    }

    return { status: "unavailable", message: "Could not reach Hypixel's API. Please try again later." };
  }
}

module.exports = { checkApiKeyStatus };
