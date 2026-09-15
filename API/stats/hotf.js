// Cumulative XP required for each HotF tier (Tiers 1 through 8)
const HOTF_EXP_TIERS = [
  0,          // Tier 1
  3000,       // Tier 2
  12000,      // Tier 3
  37000,      // Tier 4
  97000,      // Tier 5
  197000,     // Tier 6
  347000,     // Tier 7
  547000      // Tier 8
];

// HotF stops at tier 8, unlike HotM which runs to 10.
const MAX_HOTF_TIER = HOTF_EXP_TIERS.length;

/**
 * Calculates HotF level and progress from total experience.
 * @param {number} xp
 */
function getHotfLevel(xp = 0) {
  let level = 1;

  for (let i = 0; i < HOTF_EXP_TIERS.length; i++) {
    if (xp >= HOTF_EXP_TIERS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }

  const currentTierXp = HOTF_EXP_TIERS[level - 1] ?? 0;
  const nextTierXp = HOTF_EXP_TIERS[level] ?? currentTierXp;
  const xpCurrent = xp - currentTierXp;
  const xpForNext = nextTierXp - currentTierXp;

  // Calculate fractional progress to the next level
  const progress = xpForNext > 0 ? xpCurrent / xpForNext : 0;

  return {
    level,
    // Caps out at exactly 8 if they have maxed HotF
    levelWithProgress: level >= MAX_HOTF_TIER ? MAX_HOTF_TIER : level + progress
  };
}

/**
 * Returns the player's unspent whispers of one type.
 *
 * Mind the naming: `whispers.<type>.total` is the balance still available, not
 * a lifetime total. The sibling keys are per skill tree slot and track what has
 * been spent in each.
 * @param {import("../../types/profiles.js").Member} profile
 * @param {"forest" | "desert"} type
 * @returns {number}
 */
function getWhispers(profile, type) {
  return profile?.foraging_core?.whispers?.[type]?.total ?? 0;
}

/**
 * Returns the player's HotF stats.
 * @param {import("../../types/profiles.js").Member} profile
 * @returns {import("./hotf.types").HotF | null}
 */
function getHotf(profile) {
  try {
    if (!profile?.foraging_core && !profile?.skill_tree?.experience?.foraging) {
      return null;
    }

    return {
      whispers: {
        forest: getWhispers(profile, "forest"),
        desert: getWhispers(profile, "desert")
      },
      level: getHotfLevel(profile.skill_tree?.experience?.foraging ?? 0)
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

module.exports = { getHotf };
