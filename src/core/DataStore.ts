import { deriveGroundTapAutoCastSpellIds } from "../content/spellGroundTapCast";
import type { SpellDefinition } from "../content/spells";
import { setSpellCatalog } from "../content/spells";
import { applyDefenseMaps } from "../config/defenseMaps";
import { applyEnemyAi } from "../config/enemy";
import {
  applyEnemyBodyRadii,
  applyEntityPhysics,
} from "../entities/entityPhysics";
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
import { normalizeHitFlash, type HitFlashInput } from "./normalizeHitFlash";
import {
  normalizeSpellInput,
  type SpellInputConfigInput,
} from "./normalizeSpellInput";
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
import { applyHitFlashConfig } from "../config/hitFlash";
import { applySpellInputTuning } from "../config/spellInput";
import { applyShadowformMechanics } from "../config/shadowformMechanics";
import {
  normalizeTownLayout,
  type TownLayoutInput,
} from "./normalizeTownLayout";
import type { TownBuildingDef, TownLayoutDef } from "./townBuildingTypes";
import { normalizeItems } from "./normalizeItems";
import { setGearCatalog } from "../gear/gearCatalog";
import { setLootConfig, type LootConfig } from "../gear/loot";
import { normalizeLoot } from "./normalizeLoot";
import { setConsumablesConfig } from "../gear/consumables";
import { setShopsConfig } from "../gear/shops";
import { normalizeConsumables } from "./normalizeConsumables";
import { normalizeShops } from "./normalizeShops";
import type { GearCatalog } from "../gear/gearTypes";

export type EnemyDef = {
  hp: number;
  speedWu: number;
  damage: number;
  weight: number;
  challengeRating: number;
  behavior: string;
  textureKey: string;
  displayName: string;
  bodyRadiusWu: number;
  combat: EnemyCombatPartial;
};

export type WaveGroup = {
  atMs: number;
  enemyId: string;
  count: number;
  intervalMs: number;
  /**
   * Optional HP multiplier for this group (default 1). Groups at 2× or more
   * spawn as "Elite" enemies (nameplate prefix).
   */
  hpMul?: number;
  /**
   * Optional damage multiplier for this group (default 1): scales the enemy's
   * hit, wall hit and ranged / charge damage.
   */
  damageMul?: number;
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
  townLayout: TownLayoutDef = { buildingDisplayScale: 1, slots: [] };
  spells: SpellDefinition[] = [];
  shadowformMechanics!: ShadowformMechanics;
  player!: PlayerConfig;
  items!: GearCatalog;
  loot!: LootConfig;

  defenseDataReady = false;
  private defenseDataPromise: Promise<void> | null = null;

  async loadTownBoot(baseUrl = ""): Promise<void> {
    const prefix = baseUrl.replace(/\/?$/, "/");
    const [
      buildings,
      townBuildings,
      townLayout,
      playerFile,
      itemsFile,
      lootFile,
      consumablesFile,
      shopsFile,
    ] = await Promise.all([
      fetchJson<Record<string, BuildingDef>>(`${prefix}data/buildings.json`),
      fetchJson<Record<string, TownBuildingDef>>(
        `${prefix}data/town_buildings.json`,
      ),
      fetchJson<TownLayoutInput>(`${prefix}data/town_layout.json`),
      fetchJson<PlayerConfigInput>(`${prefix}data/player.json`),
      fetchJson<unknown>(`${prefix}data/items.json`),
      fetchJson<unknown>(`${prefix}data/loot.json`),
      fetchJson<unknown>(`${prefix}data/consumables.json`),
      fetchJson<unknown>(`${prefix}data/shops.json`),
    ]);
    this.buildings = buildings;
    this.townBuildings = townBuildings;
    this.townLayout = normalizeTownLayout(townLayout);
    this.player = normalizePlayerConfig(playerFile);
    const { endlessPanelDefaultConcurrent: _ui, ...playerTuning } = this.player;
    applyPlayerTuning(playerTuning);
    this.items = normalizeItems(itemsFile);
    setGearCatalog(this.items);
    this.loot = normalizeLoot(lootFile);
    setLootConfig(this.loot);
    setConsumablesConfig(normalizeConsumables(consumablesFile));
    setShopsConfig(normalizeShops(shopsFile));
  }

  async loadDefenseData(baseUrl = ""): Promise<void> {
    const prefix = baseUrl.replace(/\/?$/, "/");
    const [
      enemies,
      waves,
      spellsFile,
      defenseMaps,
      entityPhysics,
      enemyAi,
      hitFlash,
      spellInput,
    ] = await Promise.all([
      fetchJson<Record<string, EnemyDef>>(`${prefix}data/enemies.json`),
      fetchJson<Record<string, WaveDef>>(`${prefix}data/waves.json`),
      fetchJson<{ spells: SpellDefinition[] }>(`${prefix}data/spells.json`),
      fetchJson<DefenseMapsFileInput>(`${prefix}data/defense-maps.json`),
      fetchJson<EntityPhysicsInput>(`${prefix}data/entity-physics.json`),
      fetchJson<EnemyAiInput>(`${prefix}data/enemy-ai.json`),
      fetchJson<HitFlashInput>(`${prefix}data/hit-flash.json`),
      fetchJson<SpellInputConfigInput>(`${prefix}data/spell_input.json`),
    ]);
    this.enemies = Object.fromEntries(
      Object.entries(enemies).map(([id, row]) => [
        id,
        normalizeEnemyRow(id, row),
      ]),
    );
    applyEnemyBodyRadii(this.enemies);
    this.waves = waves;
    this.spells = normalizeSpellCatalog(spellsFile);
    setSpellCatalog(this.spells);
    applyDefenseMaps(defenseMaps);
    applyEntityPhysics(normalizeEntityPhysics(entityPhysics));
    for (const [id, row] of Object.entries(this.enemies)) {
      assertEnemyResolvedCombat(id, row);
    }
    applyEnemyAi(normalizeEnemyAi(enemyAi));
    applyHitFlashConfig(normalizeHitFlash(hitFlash));
    const spellInputTuning = normalizeSpellInput(spellInput);
    applySpellInputTuning({
      ...spellInputTuning,
      groundTapAutoCastSpellIds: deriveGroundTapAutoCastSpellIds(this.spells),
    });
    this.shadowformMechanics = shadowformMechanicsFromCatalog(this.spells);
    applyShadowformMechanics(this.shadowformMechanics);
    this.defenseMaps = normalizeDefenseMaps(defenseMaps);
    this.defenseDataReady = true;
  }

  ensureDefenseDataLoaded(baseUrl = ""): Promise<void> {
    if (this.defenseDataReady) return Promise.resolve();
    if (this.defenseDataPromise) return this.defenseDataPromise;
    this.defenseDataPromise = this.loadDefenseData(baseUrl).catch((err) => {
      this.defenseDataPromise = null;
      throw err;
    });
    return this.defenseDataPromise;
  }

  async loadAll(baseUrl = ""): Promise<void> {
    await this.loadTownBoot(baseUrl);
    await this.loadDefenseData(baseUrl);
  }

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

  resetDefenseDataForTests(): void {
    this.defenseDataReady = false;
    this.defenseDataPromise = null;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
