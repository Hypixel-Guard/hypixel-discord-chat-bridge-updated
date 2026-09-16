const { getLevelByXp } = require("../constants/skills.js");

/**
 * Returns the garden stats of the user.
 * @param {import("../../types/garden.js").Garden} garden
 * @returns {import("./garden.types").Garden | null}
 */
function getGarden(garden) {
  try {
    if (!garden) {
      return null;
    }

    const resources = garden.resources_collected ?? {};
    /** @param {string} cropId */
    const milestone = (cropId) => getLevelByXp(resources[cropId], { type: cropId });

    const cropMilesstone = {
      wheat: milestone("WHEAT"),
      carrot: milestone("CARROT_ITEM"),
      sugarCane: milestone("SUGAR_CANE"),
      potato: milestone("POTATO_ITEM"),
      netherWart: milestone("NETHER_STALK"),
      pumpkin: milestone("PUMPKIN"),
      melon: milestone("MELON"),
      mushroom: milestone("MUSHROOM_COLLECTION"),
      cocoaBeans: milestone("INK_SACK:3"),
      cactus: milestone("CACTUS"),
      moonflower: milestone("MOONFLOWER"),
      sunflower: milestone("DOUBLE_PLANT"),
      wildRose: milestone("WILD_ROSE")
    };

    const milestones = Object.values(cropMilesstone);
    const average = milestones.reduce((acc, { level }) => acc + level, 0) / milestones.length;

    return {
      level: getLevelByXp(garden.garden_experience, { type: "garden" }),
      cropMilesstone,
      average: average.toFixed(2)
    };
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = {
  getGarden
};
