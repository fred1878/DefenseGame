import type { SpellId } from "../content/spells";

export const SAVE_VERSION = 1;

export type SaveSpellBar = {
  /** One spell id per slot; empty string = unassigned (8 slots, 4×2 grid) */
  slots: SpellId[];
  /** Per-slot spell auto-cast (long-press in defense) */
  autoCast: boolean[];
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