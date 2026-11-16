import type { SpellDefinition } from "../content/spells";
import { setSpellCatalog } from "../content/spells";
import type { EnemyCombatPartial } from "./enemyTuning";
import { normalizeEnemyRow } from "./normalizeEnemy";
import type { TownBuildingDef, TownLayoutDef } from "./townBuildingTypes";

export type EnemyDef = {
  hp: number;
  speed: number;
  damage: number;
  behavior: string;
  textureKey: string;
  /** HUD / nameplate label (Title Case); not the content id. */
  displayName: string;
  /** Optional overrides; missing fields use per-behavior defaults. */
  combat?: EnemyCombatPartial;
  /** Endless training: target concurrent living count (3–10). */
  endlessConcurrent?: number;
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

  async loadAll(baseUrl = ""): Promise<void> {
    const prefix = baseUrl.replace(/\/?$/, "/");
    const [enemies, waves, buildings, townBuildings, townLayout, spellsFile] =
      await Promise.all([
        fetchJson<Record<string, EnemyDef>>(`${prefix}data/enemies.json`),
        fetchJson<Record<string, WaveDef>>(`${prefix}data/waves.json`),
        fetchJson<Record<string, BuildingDef>>(`${prefix}data/buildings.json`),
        fetchJson<Record<string, TownBuildingDef>>(
          `${prefix}data/town_buildings.json`,
        ),
        fetchJson<TownLayoutDef>(`${prefix}data/town_layout.json`),
        fetchJson<{ spells: SpellDefinition[] }>(`${prefix}data/spells.json`),
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
    this.spells = spellsFile.spells;
    setSpellCatalog(spellsFile.spells);
  }

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