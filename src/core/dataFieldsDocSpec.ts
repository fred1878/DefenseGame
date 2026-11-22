import {
  BUILDINGS_DOC_KEYS,
  TOWN_BUILDINGS_DOC_KEYS,
  TOWN_LAYOUT_DOC_KEYS,
  WAVES_DOC_KEYS,
} from "./dataFieldsDocKeys";
import {
  DEFENSE_MAP_BOOT_KEYS,
  DEFENSE_MAP_FIELD_BOOT_KEYS,
  DEFENSE_MAP_OBSTACLE_BOOT_KEYS,
  DEFENSE_MAPS_FILE_BOOT_KEYS,
} from "./normalizeDefenseMaps";
import {
  ENEMY_COMBAT_KIT_KEY_LISTS,
  ENEMY_COMBAT_MELEE_CHASE_STANDOFF_KEY,
} from "./normalizeEnemyCombat";
import {
  ENEMY_ROW_BOOT_KEYS,
  ENEMY_ROW_OPTIONAL_BOOT_KEYS,
} from "./normalizeEnemy";
import { ENEMY_AI_BOOT_KEYS } from "./normalizeEnemyAi";
import { ENTITY_PHYSICS_BOOT_KEYS } from "./normalizeEntityPhysics";
import { PLAYER_BOOT_KEYS } from "./normalizePlayer";
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
  "player.json": [...PLAYER_BOOT_KEYS, "autoAttackMeleeRange"],
  "defense-maps.json": uniqueSorted([
    ...DEFENSE_MAPS_FILE_BOOT_KEYS,
    ...DEFENSE_MAP_BOOT_KEYS,
    ...DEFENSE_MAP_FIELD_BOOT_KEYS,
    ...DEFENSE_MAP_OBSTACLE_BOOT_KEYS,
  ]),
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