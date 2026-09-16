import { Level } from "./skills";

export type Garden = {
  level: Level;
  cropMilesstone: {
    wheat: Level;
    carrot: Level;
    sugarCane: Level;
    potato: Level;
    netherWart: Level;
    pumpkin: Level;
    melon: Level;
    mushroom: Level;
    cocoaBeans: Level;
    cactus: Level;
    moonflower: Level;
    sunflower: Level;
    wildRose: Level;
  };
  /** Average crop milestone level across all crops, fixed to 2 decimals. */
  average: string;
};
