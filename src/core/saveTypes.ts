import type { ItemDraft } from "../gear/itemGen";
import type { SpellId } from "../content/spells";
import type { SaveGear } from "../gear/gearTypes";
import type { SaveShops } from "../gear/shops";

/** v2: gear (items + equipped slots) added; `player.weaponId` removed. */
export const SAVE_VERSION = 2;

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
    /** Base max HP plus gear `maxHp` (kept in sync by `syncPlayerHpMax`). */
    hpMax: number;
  };
  gear: SaveGear;
  /** Potion / bomb charges by `consumables.json` id. */
  consumables: Record<string, number>;
  /** Trader stock for the current day. */
  shops: SaveShops;
  spellBar: SaveSpellBar;
  flags: string[];
};

export type NightResult = {
  won: boolean;
  goldEarned: number;
  wallDamage: number;
  night: number;
  /** Gear rolled at night end; added to the bag by `applyNightResult`. */
  drops?: ItemDraft[];
};
