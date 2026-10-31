const HypixelDiscordChatBridgeError = require("../../contracts/errorHandler.js");
const { getUsername } = require("../../contracts/API/mowojangAPI.js");
const { backfillGuildMemberHistory } = require("../../contracts/gexpActivity.js");
const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

const HISTORY_FILE = path.join("data", "gexpHistory.json");
const GUILD_CACHE_MS = 60 * 1000;
let trackingStarted = false;
let refreshPromise = null;
let guildCache = null;
let guildCacheAt = 0;

function emptyHistory() {
  return { version: 1, updatedAt: null, members: {} };
}

function getTrackingConfig() {
  return require("../../../config.json").minecraft.gexpTracking ?? {};
}

function readHistory(file = HISTORY_FILE) {
  if (!fs.existsSync(file)) {
    return emptyHistory();
  }

  try {
    const history = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!history || typeof history !== "object" || typeof history.members !== "object") {
      throw new Error("Malformed history file");
    }

    return { version: 1, updatedAt: history.updatedAt ?? null, members: history.members };
  } catch (error) {
    console.error(`Unable to read GEXP history from ${file}: ${error.message}`);
    throw new HypixelDiscordChatBridgeError("The GEXP history file is corrupted. Restore data/gexpHistory.json.bak before collecting more data.");
  }
}

function saveHistory(history, file = HISTORY_FILE) {
  const directory = path.dirname(file);
  const backupFile = `${file}.bak`;
  const temporaryFile = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);

  try {
    fs.mkdirSync(directory, { recursive: true });
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, backupFile);
    }
    fs.writeFileSync(temporaryFile, JSON.stringify(history, null, 2));
    fs.renameSync(temporaryFile, file);
  } catch (error) {
    fs.rmSync(temporaryFile, { force: true });
    console.error(`Unable to persist GEXP history to ${file}: ${error.message}`);
    throw new HypixelDiscordChatBridgeError("Unable to save GEXP history. Existing history was left unchanged.");
  }
}

function getApiKey() {
  const apiKey = require("../../../config.json").minecraft.API.hypixelAPIkey;
  if (!apiKey || apiKey === "HYPIXEL_API_KEY") {
    throw new HypixelDiscordChatBridgeError("A valid Hypixel API key is required to collect GEXP activity.");
  }

  return apiKey;
}

function getBotUuid() {
  if (!bot?.uuid) {
    throw new HypixelDiscordChatBridgeError("The Minecraft bot is not ready to retrieve guild GEXP.");
  }

  return bot.uuid.replaceAll("-", "");
}

function apiError(error) {
  const status = error.response?.status;
  if (status === 401 || status === 403) {
    return new HypixelDiscordChatBridgeError("Hypixel rejected the configured API key.");
  }
  if (status === 429) {
    return new HypixelDiscordChatBridgeError("Hypixel is rate-limiting GEXP requests. Please try again shortly.");
  }

  return new HypixelDiscordChatBridgeError("Hypixel guild data is unavailable right now. Please try again later.");
}

async function fetchGuildSnapshot() {
  if (guildCache && Date.now() - guildCacheAt < GUILD_CACHE_MS) {
    return guildCache;
  }

  try {
    const response = await axios.get("https://api.hypixel.net/v2/guild", {
      headers: { "API-Key": getApiKey() },
      params: { player: getBotUuid() },
      timeout: 10000
    });
    const guild = response.data?.guild;
    if (response.data?.success !== true || !guild || !Array.isArray(guild.members)) {
      throw new HypixelDiscordChatBridgeError("The Minecraft bot does not appear to be in a Hypixel guild.");
    }

    guildCache = guild;
    guildCacheAt = Date.now();
    return guild;
  } catch (error) {
    if (error instanceof HypixelDiscordChatBridgeError) {
      throw error;
    }
    throw apiError(error);
  }
}

function applyGuildSnapshot(history, guild) {
  backfillGuildMemberHistory(history.members, guild.members, new Date().toISOString());
}

async function refreshGexpHistory() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const guild = await fetchGuildSnapshot();
    const history = readHistory();
    applyGuildSnapshot(history, guild);
    history.updatedAt = new Date().toISOString();
    saveHistory(history);
    return { guild, history };
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function populateUsernames(members, history) {
  const unresolved = members.filter((member) => !history.members[member.uuid]?.username);
  const workerCount = Math.min(5, unresolved.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < unresolved.length) {
      const member = unresolved[nextIndex++];
      try {
        const username = await getUsername(member.uuid);
        history.members[member.uuid].username = username;
      } catch (error) {
        console.warn(`Unable to resolve Minecraft username for ${member.uuid}: ${error}`);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  saveHistory(history);
}

function startGexpTracking() {
  const trackingConfig = getTrackingConfig();
  if (trackingStarted || trackingConfig.enabled === false) {
    return;
  }

  trackingStarted = true;
  const hour = Number(trackingConfig.dailyUpdateHourUtc);
  const dailyHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0;

  console.discord(`GEXP tracking ready, collecting daily at ${String(dailyHour).padStart(2, "0")}:05 UTC.`);
  refreshGexpHistory().catch((error) => console.error(`Unable to initialize GEXP history: ${error.message}`));
  cron.schedule(`5 ${dailyHour} * * *`, () => {
    refreshGexpHistory().catch((error) => console.error(`Unable to update GEXP history: ${error.message}`));
  }, { timezone: "UTC" });
}

module.exports = {
  applyGuildSnapshot,
  fetchGuildSnapshot,
  populateUsernames,
  readHistory,
  refreshGexpHistory,
  saveHistory,
  startGexpTracking
};
