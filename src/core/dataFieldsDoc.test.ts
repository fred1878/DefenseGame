import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILDINGS_DOC_KEYS,
  SHIPPED_DATA_JSON_FILES,
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

const DOC_PATH = path.join(process.cwd(), "public/data/DATA_FIELDS.md");

function loadDataFieldsDoc(): string {
  return readFileSync(DOC_PATH, "utf8");
}

function expectFieldInDoc(doc: string, key: string, context: string): void {
  expect(doc, `${context}: DATA_FIELDS.md must mention \`${key}\``).toContain(
    `\`${key}\``,
  );
}

function expectFieldsInDoc(doc: string, keys: readonly string[], context: string): void {
  for (const key of keys) {
    expectFieldInDoc(doc, key, context);
  }
}

describe("DATA_FIELDS.md", () => {
  const doc = loadDataFieldsDoc();

  it("includes CI maintenance notice in intro", () => {
    expect(doc).toMatch(/normalize\*/i);
    expect(doc).toMatch(/dataFieldsDoc\.test\.ts/i);
  });

  it("has a section per shipped public/data json file", () => {
    for (const file of SHIPPED_DATA_JSON_FILES) {
      expect(doc, `missing ## ${file} section`).toMatch(
        new RegExp(`^## ${file.replace(".", "\\.")}`, "m"),
      );
    }
  });

  it("documents enemies.json boot keys", () => {
    expectFieldsInDoc(doc, ENEMY_ROW_BOOT_KEYS, "enemies.json row");
    expectFieldsInDoc(doc, ENEMY_ROW_OPTIONAL_BOOT_KEYS, "enemies.json optional");
    expectFieldInDoc(doc, ENEMY_COMBAT_MELEE_CHASE_STANDOFF_KEY, "enemies.json combat.melee");
    for (const keys of Object.values(ENEMY_COMBAT_KIT_KEY_LISTS)) {
      expectFieldsInDoc(doc, keys, "enemies.json combat kit");
    }
  });

  it("documents enemy-ai.json boot keys", () => {
    expectFieldsInDoc(doc, ENEMY_AI_BOOT_KEYS, "enemy-ai.json");
  });

  it("documents entity-physics.json boot keys", () => {
    expectFieldsInDoc(doc, ENTITY_PHYSICS_BOOT_KEYS, "entity-physics.json");
  });

  it("documents player.json boot keys", () => {
    expectFieldsInDoc(doc, PLAYER_BOOT_KEYS, "player.json");
    expectFieldInDoc(doc, "autoAttackMeleeRange", "player.json derived");
  });

  it("documents defense-maps.json boot keys", () => {
    expectFieldsInDoc(doc, [...DEFENSE_MAPS_FILE_BOOT_KEYS], "defense-maps.json");
    expectFieldsInDoc(doc, [...DEFENSE_MAP_BOOT_KEYS], "defense-maps map");
    expectFieldsInDoc(doc, [...DEFENSE_MAP_FIELD_BOOT_KEYS], "defense-maps field");
    expectFieldsInDoc(doc, [...DEFENSE_MAP_OBSTACLE_BOOT_KEYS], "defense-maps obstacle");
  });

  it("documents spells.json boot-validated fields", () => {
    expectFieldsInDoc(doc, [...SPELLS_FILE_BOOT_KEYS], "spells.json");
    expectFieldsInDoc(doc, [...SPELL_ROW_BOOT_STRING_FIELDS], "spells row");
    for (const keys of Object.values(SPELL_MECHANIC_TYPE_BOOT_FIELDS)) {
      expectFieldsInDoc(doc, keys, "spells mechanic");
    }
    expectFieldsInDoc(doc, [...SPELL_SHADOWFORM_BOOT_FIELDS], "spells shadowform");
    expectFieldsInDoc(doc, [...SPELL_KNOCKBACK_BOOT_FIELDS], "spells knockback");
  });

  it("documents waves, buildings, and town layout keys", () => {
    expectFieldsInDoc(doc, WAVES_DOC_KEYS, "waves.json");
    expectFieldsInDoc(doc, BUILDINGS_DOC_KEYS, "buildings.json");
    expectFieldsInDoc(doc, TOWN_BUILDINGS_DOC_KEYS, "town_buildings.json");
    expectFieldsInDoc(doc, TOWN_LAYOUT_DOC_KEYS, "town_layout.json");
  });
});