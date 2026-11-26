/**
 * Field names documented for JSON loaded at Boot without a dedicated normalize* module.
 * Kept in sync with `docs/DATA_FIELDS.md`; CI reads this via `dataFieldsDoc.test.ts`.
 */

export const WAVES_DOC_KEYS = [
  "rewardGold",
  "groups",
  "atMs",
  "enemyId",
  "count",
  "intervalMs",
  "hpMul",
  "damageMul",
] as const;

export const BUILDINGS_DOC_KEYS = [
  "maxLevel",
  "costByLevel",
  "effect",
] as const;

export const TOWN_BUILDINGS_DOC_KEYS = [
  "label",
  "textureKey",
  "width",
  "height",
  "upgradeId",
  "startsNight",
  "opensSpellBar",
  "opensEndlessMode",
  "opensWavePlanner",
  "opensSaveMenu",
  "opensShop",
] as const;

export const TOWN_LAYOUT_DOC_KEYS = [
  "buildingDisplayScale",
  "slots",
  "buildingId",
  "x",
  "y",
] as const;

/** Shipped runtime JSON under `public/data/` (excludes removed legacy files). */
export const SHIPPED_DATA_JSON_FILES = [
  "buildings.json",
  "defense-maps.json",
  "enemies.json",
  "enemy-ai.json",
  "entity-physics.json",
  "hit-flash.json",
  "items.json",
  "loot.json",
  "consumables.json",
  "shops.json",
  "talents.json",
  "player.json",
  "spell_input.json",
  "spells.json",
  "town_buildings.json",
  "town_layout.json",
  "waves.json",
] as const;
