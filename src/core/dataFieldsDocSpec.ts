import {
  BUILDINGS_DOC_KEYS,
  TOWN_BUILDINGS_DOC_KEYS,
  TOWN_LAYOUT_DOC_KEYS,
  WAVES_DOC_KEYS,
} from "./dataFieldsDocKeys";
import { LOOT_FILE_BOOT_KEYS, LOOT_TABLE_BOOT_KEYS } from "./normalizeLoot";
import {
  DEFENSE_MAP_BOOT_KEYS,
  DEFENSE_MAP_FIELD_BOOT_KEYS,
  DEFENSE_MAP_OBSTACLE_BOOT_KEYS,
  DEFENSE_MAPS_FILE_BOOT_KEYS,
} from "./normalizeDefenseMaps";
import {
  ENEMY_ATTACK_MOVEMENT_KEYS,
  ENEMY_COMBAT_KIT_KEY_LISTS,
  ENEMY_COMBAT_MELEE_CHASE_STANDOFF_KEY,
  ENEMY_COMBAT_MELEE_OPTIONAL_KEYS,
} from "./normalizeEnemyCombat";
import {
  ENEMY_ROW_BOOT_KEYS,
  ENEMY_ROW_OPTIONAL_BOOT_KEYS,
} from "./normalizeEnemy";
import { ENEMY_AI_BOOT_KEYS } from "./normalizeEnemyAi";
import { ENTITY_PHYSICS_BOOT_KEYS } from "./normalizeEntityPhysics";
import {
  HIT_FLASH_BOOT_KEYS,
  HIT_FLASH_FLAVOR_BOOT_KEYS,
} from "./normalizeHitFlash";
import {
  ITEMS_AFFIX_BOOT_KEYS,
  ITEMS_BASE_BOOT_KEYS,
  ITEMS_FILE_BOOT_KEYS,
  ITEMS_MELEE_BOOT_KEYS,
  ITEMS_MODIFIER_BOOT_KEYS,
  ITEMS_RANGED_BOOT_KEYS,
  ITEMS_RARITY_BOOT_KEYS,
  ITEMS_UNIQUE_BOOT_KEYS,
  ITEMS_WEAPON_EXTRA_KEYS,
} from "./normalizeItems";
import { PLAYER_BOOT_KEYS } from "./normalizePlayer";
import { SPELL_INPUT_BOOT_KEYS } from "./normalizeSpellInput";
import {
  SPELL_KNOCKBACK_BOOT_FIELDS,
  SPELL_MECHANIC_TYPE_BOOT_FIELDS,
  SPELL_ROW_BOOT_STRING_FIELDS,
  SPELL_SHADOWFORM_BOOT_FIELDS,
  SPELLS_FILE_BOOT_KEYS,
} from "./normalizeSpells";

function uniqueSorted(keys: readonly string[]): string[] {
  return [...new Set(keys)].sort();
}

const ENEMY_COMBAT_SCALAR_KEYS = uniqueSorted([
  ...Object.values(ENEMY_COMBAT_KIT_KEY_LISTS).flat(),
  ENEMY_COMBAT_MELEE_CHASE_STANDOFF_KEY,
  ...ENEMY_COMBAT_MELEE_OPTIONAL_KEYS,
  ...ENEMY_ATTACK_MOVEMENT_KEYS,
]);

/** Boot- or schema-documented scalars per `public/data/*.json` file (CI parity set). */
export const BOOT_DOCUMENTED_KEYS_BY_FILE: Record<string, readonly string[]> = {
  "enemies.json": uniqueSorted([
    ...ENEMY_ROW_BOOT_KEYS,
    ...ENEMY_ROW_OPTIONAL_BOOT_KEYS,
    ...ENEMY_COMBAT_SCALAR_KEYS,
  ]),
  "enemy-ai.json": [...ENEMY_AI_BOOT_KEYS],
  "entity-physics.json": [...ENTITY_PHYSICS_BOOT_KEYS],
  "hit-flash.json": uniqueSorted([
    ...HIT_FLASH_BOOT_KEYS,
    ...HIT_FLASH_FLAVOR_BOOT_KEYS,
  ]),
  "items.json": uniqueSorted([
    ...ITEMS_FILE_BOOT_KEYS,
    ...ITEMS_RARITY_BOOT_KEYS,
    ...ITEMS_BASE_BOOT_KEYS,
    ...ITEMS_MELEE_BOOT_KEYS,
    ...ITEMS_RANGED_BOOT_KEYS,
    ...ITEMS_WEAPON_EXTRA_KEYS,
    ...ITEMS_AFFIX_BOOT_KEYS,
    ...ITEMS_UNIQUE_BOOT_KEYS,
    ...ITEMS_MODIFIER_BOOT_KEYS,
  ]),
  "loot.json": uniqueSorted([...LOOT_FILE_BOOT_KEYS, ...LOOT_TABLE_BOOT_KEYS]),
  "player.json": [...PLAYER_BOOT_KEYS, "autoAttackMeleeRange"],
  "defense-maps.json": uniqueSorted([
    ...DEFENSE_MAPS_FILE_BOOT_KEYS,
    ...DEFENSE_MAP_BOOT_KEYS,
    ...DEFENSE_MAP_FIELD_BOOT_KEYS,
    ...DEFENSE_MAP_OBSTACLE_BOOT_KEYS,
  ]),
  "spell_input.json": [...SPELL_INPUT_BOOT_KEYS, "groundTapAutoCastSpellIds"],
  "spells.json": uniqueSorted([
    ...SPELLS_FILE_BOOT_KEYS,
    ...SPELL_ROW_BOOT_STRING_FIELDS,
    ...Object.values(SPELL_MECHANIC_TYPE_BOOT_FIELDS).flat(),
    ...SPELL_SHADOWFORM_BOOT_FIELDS,
    ...SPELL_KNOCKBACK_BOOT_FIELDS,
  ]),
  "waves.json": [...WAVES_DOC_KEYS],
  "buildings.json": [...BUILDINGS_DOC_KEYS],
  "town_buildings.json": [...TOWN_BUILDINGS_DOC_KEYS],
  "town_layout.json": [...TOWN_LAYOUT_DOC_KEYS],
};
