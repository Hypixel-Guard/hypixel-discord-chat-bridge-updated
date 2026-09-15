import { Level } from "./skills.types";

export type HotF = {
  /** Unspent whispers of each type. */
  whispers: {
    forest: number;
    desert: number;
  };
  level: Level;
};
