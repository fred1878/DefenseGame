import type { SpellDefinition } from "../content/spells";
import { setSpellCatalog } from "../content/spells";
import { applyDefenseMaps } from "../config/defenseMaps";
import { applyEnemyAi } from "../config/enemy";
import { applyEnemyBodyRadii, applyEntityPhysics } from "../entities/entityPhysics";
import { applyPlayerTuning } from "../config/player";
import {
  normalizeDefenseMaps,
  type DefenseMapsFileInput,
} from "./normalizeDefenseMaps";
import {
  normalizeEntityPhysics,
  type EntityPhysicsInput,
} from "./normalizeEntityPhysics";
import { normalizeEnemyAi, type EnemyAiInput } from "./normalizeEnemyAi";
import type { EnemyCombatPartial } from "./enemyTuning";
import { assertEnemyResolvedCombat, normalizeEnemyRow } from "./normalizeEnemy";
import {
  normalizePlayerConfig,
  type PlayerConfig,
  type PlayerConfigInput,
} from "./normalizePlayer";
import {
  normalizeSpellCatalog,
  shadowformMechanicsFromCatalog,
} from "./normalizeSpells";
import type { ShadowformMechanics } from "../config/shadowformMechanics";
import { applyShadowformMechanics } from "../config/shadowformMechanics";
import type { TownBuildingDef, TownLayoutDef } from "./townBuildingTypes";

export type EnemyDef = {
  hp: number;
  speedWu: number;
  damage: number;
  /** Knockback resistance baseline: 100 = full authored knockback strength. */
  weight: number;
  /** Relative threat tier for UI / wave planning (not combat math yet). */
  challengeRating: number;
  behavior: string;
  textureKey: string;
  /** HUD / nameplate label (Title Case); not the content id. */
  displayName: string;
  /** Arcade physics circle radius (authored world units). */
  bodyRadiusWu: number;
  /** Full explicit combat tables for this enemy row. */
  combat: EnemyCombatPartial;
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
  shadowformMechanics!: ShadowformMechanics;
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
      defenseMaps,
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
      fetchJson<DefenseMapsFileInput>(`${prefix}data/defense-maps.json`),
      fetchJson<EntityPhysicsInput>(`${prefix}data/entity-physics.json`),
      fetchJson<EnemyAiInput>(`${prefix}data/enemy-ai.json`),
    ]);
    this.enemies = Object.fromEntries(
      Object.entries(enemies).map(([id, row]) => [
        id,
        normalizeEnemyRow(id, row),
      ]),
    );
    applyEnemyBodyRadii(this.enemies);
    this.waves = waves;
    this.buildings = buildings;
    this.townBuildings = townBuildings;
    this.townLayout = townLayout;
    this.spells = normalizeSpellCatalog(spellsFile);
    setSpellCatalog(this.spells);
    this.player = normalizePlayerConfig(playerFile);
    const { endlessPanelDefaultConcurrent: _ui, ...playerTuning } = this.player;
    applyPlayerTuning(playerTuning);
    applyDefenseMaps(defenseMaps);
    applyEntityPhysics(normalizeEntityPhysics(entityPhysics));
    for (const [id, row] of Object.entries(this.enemies)) {
      assertEnemyResolvedCombat(id, row);
    }
    applyEnemyAi(normalizeEnemyAi(enemyAi));
    this.shadowformMechanics = shadowformMechanicsFromCatalog(this.spells);
    applyShadowformMechanics(this.shadowformMechanics);
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
