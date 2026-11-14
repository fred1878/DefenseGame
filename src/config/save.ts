import type { SpellId } from "./spells";

export const SAVE_VERSION = 1;

export type SaveSpellBar = {
  /** One spell id per slot; empty string = unassigned */
  slots: SpellId[];
};

export type SaveGame = {
  night: number;
  gold: number;
  buildings: Record<string, number>;
  townWallHp: number;
  townWallHpMax: number;
  player: {
    hp: number;
    hpMax: number;
    weaponId: string;
    moveSpeed: number;
  };
  spellBar: SaveSpellBar;
  flags: string[];
};

export type NightResult = {
  won: boolean;
  goldEarned: number;
  wallDamage: number;
  night: number;
};