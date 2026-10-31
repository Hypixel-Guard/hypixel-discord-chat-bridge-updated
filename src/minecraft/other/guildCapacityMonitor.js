const config = require("../../../config.json");

const MEMBER_CAPACITY = 125;
let cachedMemberCount = null;
let memberCountRequest = null;
let lastNotifiedFullCount = null;

function stripMinecraftFormatting(message) {
  return message.replace(/\u00a7[0-9a-fk-or]/gi, "");
}

function requestGuildMemberCount() {
  return new Promise((resolve, reject) => {
    const listener = (message) => {
      const formattedMessage = stripMinecraftFormatting(message.toString()).trim();
      const match = formattedMessage.match(/^Total Members:\s*(\d+)/i);
      if (!match) {
        return;
      }

      clearTimeout(timeout);
      bot.removeListener("message", listener);
      resolve(Number(match[1]));
    };

    bot.on("message", listener);
    const timeout = setTimeout(() => {
      bot.removeListener("message", listener);
      reject(new Error("Could not retrieve the guild member count."));
    }, 5000);

    bot.chat("/g online");
  });
}

async function refreshGuildMemberCount() {
  if (memberCountRequest) {
    return memberCountRequest;
  }

  memberCountRequest = requestGuildMemberCount()
    .then((memberCount) => {
      cachedMemberCount = memberCount;
      return memberCount;
    })
    .finally(() => {
      memberCountRequest = null;
    });

  return memberCountRequest;
}

function getCachedGuildMemberCount() {
  return cachedMemberCount;
}

async function checkGuildCapacity() {
  const memberCount = await refreshGuildMemberCount();
  if (memberCount < MEMBER_CAPACITY) {
    lastNotifiedFullCount = null;
    return memberCount;
  }

  const alert = config.discord.guildCapacityAlert;
  if (!alert?.enabled || !alert.moderatorUserId || lastNotifiedFullCount === memberCount) {
    return memberCount;
  }

  const moderatorChannel = client.channels.cache.get(config.discord.channels.officerChannel);
  if (!moderatorChannel) {
    throw new Error("The configured officer channel could not be found.");
  }

  await moderatorChannel.send(`<@${alert.moderatorUserId}> The guild is now full (${memberCount}/${MEMBER_CAPACITY} members).`);
  lastNotifiedFullCount = memberCount;

  return memberCount;
}

module.exports = {
  MEMBER_CAPACITY,
  checkGuildCapacity,
  getCachedGuildMemberCount,
  refreshGuildMemberCount
};
