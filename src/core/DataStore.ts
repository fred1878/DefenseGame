import type { SpellDefinition } from "../content/spells";
import { setSpellCatalog } from "../content/spells";
import { applyDefenseMaps } from "../config/defenseMaps";
import { applyEnemyAi } from "../config/enemy";
import { applySpellMechanics } from "../combat/spellMechanics";
import { applyEntityPhysics } from "../entities/entityPhysics";
import { applyEnemyCombatDefaults } from "./enemyTuning";
import {
  normalizeDefenseMaps,
  type DefenseMapsFileInput,
} from "./normalizeDefenseMaps";
import {
  normalizeSpellMechanics,
  type SpellMechanicsInput,
} from "./normalizeSpellMechanics";
import {
  normalizeEntityPhysics,
  type EntityPhysicsInput,
} from "./normalizeEntityPhysics";
import { normalizeEnemyAi, type EnemyAiInput } from "./normalizeEnemyAi";
import type { EnemyCombatPartial } from "./enemyTuning";
import type { EnemyCombatDefaultsInput } from "./normalizeEnemyCombatDefaults";
import { assertEnemyResolvedCombat, normalizeEnemyRow } from "./normalizeEnemy";
import {
  normalizePlayerConfig,
  type PlayerConfig,
  type PlayerConfigInput,
} from "./normalizePlayer";
import { normalizeSpellCatalog } from "./normalizeSpells";
import type { TownBuildingDef, TownLayoutDef } from "./townBuildingTypes";

export type EnemyDef = {
  hp: number;
  speed: number;
  damage: number;
  /** Knockback resistance baseline: 100 = full authored knockback strength. */
  weight: number;
  behavior: string;
  textureKey: string;
  /** HUD / nameplate label (Title Case); not the content id. */
  displayName: string;
  /** Optional overrides; missing fields use per-behavior defaults. */
  combat?: EnemyCombatPartial;
};

export type WaveGroup = {
  atMs: number;
  enemyId: string;
  count: number;
  intervalMs: number;
};

export type WaveDef = {
  rewardGold: number;
  groups: WaveGroup[];
};

export type BuildingDef = {
  maxLevel: number;
  costByLevel: number[];
  effect: string;
};

export class DataStore {
  enemies: Record<string, EnemyDef> = {};
  waves: Record<string, WaveDef> = {};
  buildings: Record<string, BuildingDef> = {};
  townBuildings: Record<string, TownBuildingDef> = {};
  townLayout: TownLayoutDef = { slots: [] };
  spells: SpellDefinition[] = [];
  /** From `public/data/player.json` (combat tuning + endless panel UI seed). */
  player!: PlayerConfig;

  async loadAll(baseUrl = ""): Promise<void> {
    const prefix = baseUrl.replace(/\/?$/, "/");
    const [
      enemies,
      waves,
      buildings,
      townBuildings,
      townLayout,
      spellsFile,
      playerFile,
      enemyCombatDefaults,
      defenseMaps,
      spellMechanics,
      entityPhysics,
      enemyAi,
    ] = await Promise.all([
      fetchJson<Record<string, EnemyDef>>(`${prefix}data/enemies.json`),
      fetchJson<Record<string, WaveDef>>(`${prefix}data/waves.json`),
      fetchJson<Record<string, BuildingDef>>(`${prefix}data/buildings.json`),
      fetchJson<Record<string, TownBuildingDef>>(
        `${prefix}data/town_buildings.json`,
      ),
      fetchJson<TownLayoutDef>(`${prefix}data/town_layout.json`),
      fetchJson<{ spells: SpellDefinition[] }>(`${prefix}data/spells.json`),
      fetchJson<PlayerConfigInput>(`${prefix}data/player.json`),
      fetchJson<EnemyCombatDefaultsInput>(
        `${prefix}data/enemy-combat-defaults.json`,
      ),
      fetchJson<DefenseMapsFileInput>(`${prefix}data/defense-maps.json`),
      fetchJson<SpellMechanicsInput>(`${prefix}data/spell-mechanics.json`),
      fetchJson<EntityPhysicsInput>(`${prefix}data/entity-physics.json`),
      fetchJson<EnemyAiInput>(`${prefix}data/enemy-ai.json`),
    ]);
    this.enemies = Object.fromEntries(
      Object.entries(enemies).map(([id, row]) => [
        id,
        normalizeEnemyRow(id, row),
      ]),
    );
    this.waves = waves;
    this.buildings = buildings;
    this.townBuildings = townBuildings;
    this.townLayout = townLayout;
    this.spells = normalizeSpellCatalog(spellsFile);
    setSpellCatalog(this.spells);
    this.player = normalizePlayerConfig(playerFile);
    applyEnemyCombatDefaults(enemyCombatDefaults);
    applyDefenseMaps(defenseMaps);
    applySpellMechanics(normalizeSpellMechanics(spellMechanics));
    applyEntityPhysics(normalizeEntityPhysics(entityPhysics));
    for (const [id, row] of Object.entries(this.enemies)) {
      assertEnemyResolvedCombat(id, row);
    }
    applyEnemyAi(normalizeEnemyAi(enemyAi));
    this.defenseMaps = normalizeDefenseMaps(defenseMaps);
  }

  /** Resolved defense map registry (set in `loadAll`). */
  defenseMaps!: ReturnType<typeof normalizeDefenseMaps>;

  getWaveForNight(night: number): WaveDef | undefined {
    const direct = this.waves[String(night)];
    if (direct) return direct;
    let best: number | null = null;
    for (const key of Object.keys(this.waves)) {
      const n = Number(key);
      if (!Number.isFinite(n)) continue;
      if (n <= night && (best === null || n > best)) best = n;
    }
    if (best !== null) return this.waves[String(best)];
    return this.waves["1"];
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
