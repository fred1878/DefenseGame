import type { SpellId } from "../content/spells";

export const SAVE_VERSION = 1;

export type SaveSpellBar = {
  /** One spell id per slot; empty string = unassigned (8 slots, 4×2 grid) */
  slots: SpellId[];
  /** Spell ids with auto-cast enabled (long-press); follows the spell, not the slot index. */
  autoCastSpellIds: SpellId[];
  /** @deprecated Migrated to `autoCastSpellIds` on load. */
  autoCast?: boolean[];
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