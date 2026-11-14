export type EnemyDef = {
  hp: number;
  speed: number;
  damage: number;
  behavior: string;
  textureKey: string;
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

  async loadAll(baseUrl = ""): Promise<void> {
    const prefix = baseUrl.replace(/\/?$/, "/");
    const [enemies, waves, buildings] = await Promise.all([
      fetchJson<Record<string, EnemyDef>>(`${prefix}data/enemies.json`),
      fetchJson<Record<string, WaveDef>>(`${prefix}data/waves.json`),
      fetchJson<Record<string, BuildingDef>>(`${prefix}data/buildings.json`),
    ]);
    this.enemies = enemies;
    this.waves = waves;
    this.buildings = buildings;
  }

  getWaveForNight(night: number): WaveDef | undefined {
    return this.waves[String(night)];
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}