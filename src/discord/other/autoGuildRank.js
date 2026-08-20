const { getPlayerVariableStats } = require("../../contracts/getVariableStats.js");
const hypixelRebornAPI = require("../../contracts/API/HypixelRebornAPI.js");
const { titleCaseCamel } = require("../../contracts/helperFunctions.js");
const { getUsername } = require("../../contracts/API/mowojangAPI.js");
const config = require("../../../config.json");
const cron = require("node-cron");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getRequiredToHave(rule) {
  return rule.requiredToHave ?? Object.keys(rule.requirements ?? {}).length;
}

function getFromRanks(rule) {
  if (Array.isArray(rule.fromRanks)) return rule.fromRanks;
  if (typeof rule.fromRank === "string") return [rule.fromRank];
  return [];
}

function passesRequirements(stats, rule) {
  const requirements = getRequirementResults(stats, rule);
  const passed = requirements.filter(({ passed }) => passed).length;

  return passed >= getRequiredToHave(rule);
}

function shouldApplyRule(stats, rule) {
  const action = String(rule.action ?? "promote").toLowerCase();
  const passed = passesRequirements(stats, rule);

  return action === "demote" ? !passed : passed;
}

function getRequirementResults(stats, rule) {
  return Object.entries(rule.requirements ?? {}).map(([key, required]) => {
    const has = Number(stats[key] ?? 0);
    return { key, required: Number(required), has, passed: has >= Number(required) };
  });
}

function getActionText(action) {
  return action === "demote" ? "demoted" : "promoted";
}

function formatStatValue(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function buildAutoRankEmbed({ action, username, oldRank, rule, stats }) {
  const requirements = getRequirementResults(stats, rule);
  const requirementsPassed = requirements.filter(({ passed }) => passed).length;
  const requiredToHave = getRequiredToHave(rule);
  const actionText = getActionText(action);

  return {
    color: action === "demote" ? 15548997 : 2067276,
    title: `${username} was auto ${actionText}`,
    description:
      `Auto ${actionText} \`${username}\` from \`${oldRank}\` using rule \`${rule.name ?? "unnamed"}\`.\n\n` +
      `${username} meets **${requirementsPassed} requirement(s)** out of the required **${requiredToHave} requirement(s)** for this rule.`,
    thumbnail: {
      url: `https://www.mc-heads.net/avatar/${username}`
    },
    fields: requirements.map(({ key, has, required, passed }) => ({
      name: titleCaseCamel(key),
      value: `${passed ? ":white_check_mark:" : ":x:"} ${formatStatValue(has)}/${formatStatValue(required)}`,
      inline: true
    }))
  };
}

async function logAutoRank(embed) {
  const channelId = config.discord.channels.loggingChannel;
  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    console.warn(`AutoGuildRank log channel not found: ${channelId}`);
    return;
  }

  await channel.send({
    embeds: [embed]
  });
}

async function runAutoGuildRank() {
  if (!config.minecraft.guildAutoRank?.enabled) {
    return;
  }

  if (bot === undefined || bot._client?.chat === undefined) {
    console.warn("AutoGuildRank skipped because the Minecraft bot is not connected.");
    return;
  }

  const rules = config.minecraft.guildAutoRank.rules ?? [];
  if (rules.length === 0) {
    return;
  }

  const hypixelGuild = await hypixelRebornAPI.getGuild("player", bot.username, { noCaching: true, noCacheCheck: true });
  for (const member of hypixelGuild.members) {
    for (const rule of rules) {
      const action = String(rule.action ?? "promote").toLowerCase();
      if (!["promote", "demote"].includes(action)) {
        console.warn(`AutoGuildRank skipped rule with invalid action: ${rule.action}`);
        continue;
      }

      const fromRanks = getFromRanks(rule);
      if (fromRanks.length === 0) {
        console.warn(`AutoGuildRank skipped rule "${rule.name ?? "unnamed"}" because it has no fromRank/fromRanks.`);
        continue;
      }

      if (!fromRanks.includes(member.rank)) {
        continue;
      }

      const stats = await getPlayerVariableStats(member.uuid, hypixelGuild);
      if (!shouldApplyRule(stats, rule)) {
        continue;
      }

      const username = stats.username || (await getUsername(member.uuid));
      bot.chat(`/g ${action} ${username}`);
      await logAutoRank(buildAutoRankEmbed({ action, username, oldRank: member.rank, rule, stats }));
      await delay(3000);
      break;
    }
  }
}

if (config.minecraft.guildAutoRank?.enabled) {
  console.discord(`AutoGuildRank ready, executing every ${config.minecraft.guildAutoRank.interval} hours.`);
  cron.schedule(`0 */${config.minecraft.guildAutoRank.interval} * * *`, () => {
    runAutoGuildRank().catch((error) => console.error(error));
  });
}

module.exports = { runAutoGuildRank };
