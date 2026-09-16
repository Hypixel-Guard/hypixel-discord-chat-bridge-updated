/**
 * Returns the obsidian collection of a profile.
 * @param {import("../../types/profiles").Member} profile
 * @returns {number | null}
 */
function getObsidianCollection(profile) {
  try {
    return profile.collection?.OBSIDIAN ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

module.exports = {
  getObsidianCollection
};
