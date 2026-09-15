// CREDITS: by @Kathund (https://github.com/Kathund)
const CONSTANTS = require("../constants/mining.js");
const moment = require("moment");

// Cumulative XP required for each HotM tier (Tiers 1 through 10)
const HOTM_EXP_TIERS = [
  0,          // Tier 1
  3000,       // Tier 2
  12000,      // Tier 3
  37000,      // Tier 4
  97000,      // Tier 5
  197000,     // Tier 6
  347000,     // Tier 7
  557000,     // Tier 8
  837000,     // Tier 9
  1197000     // Tier 10
];

/**
 * Calculates HotM level and progress from total experience.
 * @param {number} xp
 */
function getHotmLevel(xp = 0) {
  let level = 1;

  for (let i = 0; i < HOTM_EXP_TIERS.length; i++) {
    if (xp >= HOTM_EXP_TIERS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }

  const currentTierXp = HOTM_EXP_TIERS[level - 1] ?? 0;
  const nextTierXp = HOTM_EXP_TIERS[level] ?? currentTierXp;
  const xpCurrent = xp - currentTierXp;
  const xpForNext = nextTierXp - currentTierXp;
  
  // Calculate fractional progress to the next level
  const progress = xpForNext > 0 ? (xpCurrent / xpForNext) : 0;

  return {
    level,
    // Caps out at exactly 10 if they have maxed HotM
    levelWithProgress: level >= 10 ? 10 : level + progress 
  };
}

/**
 * Reads one powder type off a profile.
 *
 * Hypixel's field names are misleading here: `powder_<type>` is the lifetime
 * total ever collected, while `powder_<type>_total` is the amount still
 * unspent. Both are stored outright, so neither one should be derived by
 * adding `powder_spent_<type>` on top of the other.
 * @param {import("../../types/profiles.js").Member} profile
 * @param {"mithril" | "gemstone" | "glacite"} type
 * @returns {{ spent: number, current: number, total: number }}
 */
function getPowder(profile, type) {
  const miningCore = profile?.mining_core;
  const spent = miningCore?.[`powder_spent_${type}`] ?? 0;
  const total = miningCore?.[`powder_${type}`] ?? 0;
  // Fall back for profiles saved before Hypixel added the `_total` field.
  const current = miningCore?.[`powder_${type}_total`] ?? Math.max(total - spent, 0);

  return { spent, current, total };
}

/**
 * Returns the player's HotM stats.
 * @param {import("../../types/profiles.js").Member} profile
 * @returns {import("./hotm.types").HotM | null}
 */
function getHotm(profile) {
  try {
    // Check for both in case it's a new or old profile format
    if (!profile?.mining_core && !profile?.skill_tree) {
      return null;
    }

    // THE FIX: Point to the new skill_tree path!
    const hotmXp = profile.skill_tree?.experience?.mining ?? profile.mining_core?.experience ?? 0;

    return {
      powder: {
        mithril: getPowder(profile, "mithril"),
        gemstone: getPowder(profile, "gemstone"),
        glacite: getPowder(profile, "glacite")
      },
      level: getHotmLevel(hotmXp),
      // @ts-ignore
      ability: CONSTANTS.hotm.perks[profile.mining_core?.selected_pickaxe_ability]?.name ?? "None"
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}
/**
 * @param {import("../../types/profiles.js").Member} profile
 * @returns {import("./hotm.types").Forge | null}
 */
function getForge(profile) {
  const forgeItems = [];
  if (!profile.forge?.forge_processes?.forge_1) {
    return null;
  }

  const forge = Object.values(profile.forge.forge_processes.forge_1);

  for (const item of forge) {
    const forgeItem = {
      id: item.id,
      name: "Unknown Item",
      slot: item.slot,
      timeStarted: item.startTime,
      timeFinished: 0,
      timeFinishedText: ""
    };

    if (item.id in CONSTANTS.forge.items) {
      // @ts-ignore
      let forgeTime = CONSTANTS.forge.items[item.id].duration;
      const quickForge = profile.mining_core?.nodes?.forge_time;
      if (quickForge != null) {
        // @ts-ignore
        forgeTime *= CONSTANTS.forge.quickForgeMultiplier[quickForge];
      }

      // @ts-ignore
      forgeItem.name = CONSTANTS.forge.items[item.id].name;

      const timeFinished = item.startTime + forgeTime;
      forgeItem.timeStarted = item.startTime;
      forgeItem.timeFinished = timeFinished;
      forgeItem.timeFinishedText = timeFinished < Date.now() ? "(FINISHED)" : ` (${moment(timeFinished).fromNow()})`;
    }

    forgeItems.push(forgeItem);
  }

  return forgeItems;
}

module.exports = {
  getHotm,
  getForge
};
