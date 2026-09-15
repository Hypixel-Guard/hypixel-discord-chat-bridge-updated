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
        mithril: {
          spent: profile.mining_core?.powder_spent_mithril ?? 0,
          current: profile.mining_core?.powder_mithril ?? 0,
          total: (profile.mining_core?.powder_spent_mithril ?? 0) + (profile.mining_core?.powder_mithril ?? 0)
        },
        gemstone: {
          spent: profile.mining_core?.powder_spent_gemstone ?? 0,
          current: profile.mining_core?.powder_gemstone ?? 0,
          total: (profile.mining_core?.powder_spent_gemstone ?? 0) + (profile.mining_core?.powder_gemstone ?? 0)
        },
        glacite: {
          spent: profile.mining_core?.powder_spent_glacite ?? 0,
          current: profile.mining_core?.powder_glacite ?? 0,
          total: (profile.mining_core?.powder_spent_glacite ?? 0) + (profile.mining_core?.powder_glacite ?? 0)
        }
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
