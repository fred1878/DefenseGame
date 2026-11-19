import { OBSTACLE_TEXTURE, type ObstacleTextureKey } from "../content/assets";
import type { DefenseObstaclePlacement } from "../config/defense";

const VALID_TEXTURE_KEYS = new Set<string>(
  Object.values(OBSTACLE_TEXTURE),
);

export type DefenseMapFieldInput = { cols?: number; rows?: number };

export type DefenseMapObstacleInput = {
  tileX?: number;
  tileY?: number;
  textureKey?: string;
};

export type DefenseMapInput = {
  id?: string;
  field?: DefenseMapFieldInput;
  obstacles?: DefenseMapObstacleInput[];
};

export type DefenseMapsFileInput = {
  defaultMapId?: string;
  maps?: DefenseMapInput[];
};

export type DefenseFieldTiles = { cols: number; rows: number };

export type DefenseMapDef = {
  id: string;
  field: DefenseFieldTiles;
  obstacles: DefenseObstaclePlacement[];
};

export type DefenseMapsRegistry = {
  defaultMapId: string;
  maps: DefenseMapDef[];
};

export const CODE_DEFENSE_FIELD: DefenseFieldTiles = { cols: 13, rows: 22 };

export const CODE_DEFENSE_OBSTACLE_PLACEMENTS: DefenseObstaclePlacement[] = [
  { tileX: 2, tileY: 3, textureKey: OBSTACLE_TEXTURE.wideSlab },
  { tileX: 10, tileY: 4, textureKey: OBSTACLE_TEXTURE.tallRock },
  { tileX: 2, tileY: 15, textureKey: OBSTACLE_TEXTURE.rubbleLow },
  { tileX: 10, tileY: 16, textureKey: OBSTACLE_TEXTURE.boulderSm },
  { tileX: 6, tileY: 2, textureKey: OBSTACLE_TEXTURE.boulderMed },
  { tileX: 9, tileY: 11, textureKey: OBSTACLE_TEXTURE.boulderSm },
  { tileX: 4, tileY: 10, textureKey: OBSTACLE_TEXTURE.boulderMed },
  { tileX: 6, tileY: 8, textureKey: OBSTACLE_TEXTURE.rubbleLow },
];

function normalizeTextureKey(raw: string | undefined): ObstacleTextureKey {
  if (raw && VALID_TEXTURE_KEYS.has(raw)) {
    return raw as ObstacleTextureKey;
  }
  return OBSTACLE_TEXTURE.wideSlab;
}

function normalizePlacement(row: DefenseMapObstacleInput): DefenseObstaclePlacement | null {
  const tileX = row.tileX;
  const tileY = row.tileY;
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;
  return {
    tileX: tileX!,
    tileY: tileY!,
    textureKey: normalizeTextureKey(row.textureKey),
  };
}

function normalizeMap(
  row: DefenseMapInput,
  fallbackId: string,
): DefenseMapDef | null {
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : fallbackId;
  const cols = row.field?.cols ?? CODE_DEFENSE_FIELD.cols;
  const rows = row.field?.rows ?? CODE_DEFENSE_FIELD.rows;
  if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 1 || rows < 1) {
    return null;
  }
  const obstacles = (row.obstacles ?? [])
    .map(normalizePlacement)
    .filter((p): p is DefenseObstaclePlacement => p !== null);
  return {
    id,
    field: { cols, rows },
    obstacles: obstacles.length > 0 ? obstacles : [...CODE_DEFENSE_OBSTACLE_PLACEMENTS],
  };
}

/** Fallback single-map registry when JSON is missing or invalid. */
export function codeDefenseMapsRegistry(): DefenseMapsRegistry {
  return {
    defaultMapId: "night-field",
    maps: [
      {
        id: "night-field",
        field: { ...CODE_DEFENSE_FIELD },
        obstacles: [...CODE_DEFENSE_OBSTACLE_PLACEMENTS],
      },
    ],
  };
}

export function normalizeDefenseMaps(
  raw: DefenseMapsFileInput | null | undefined,
): DefenseMapsRegistry {
  const fallback = codeDefenseMapsRegistry();
  if (!raw?.maps?.length) return fallback;
  const maps: DefenseMapDef[] = [];
  for (let i = 0; i < raw.maps.length; i++) {
    const m = normalizeMap(raw.maps[i]!, `map-${i + 1}`);
    if (m) maps.push(m);
  }
  if (maps.length === 0) return fallback;
  const defaultMapId =
    typeof raw.defaultMapId === "string" && raw.defaultMapId.trim()
      ? raw.defaultMapId.trim()
      : fallback.defaultMapId;
  const hasDefault = maps.some((m) => m.id === defaultMapId);
  return {
    defaultMapId: hasDefault ? defaultMapId : maps[0]!.id,
    maps,
  };
}

export function resolveDefenseMap(
  registry: DefenseMapsRegistry,
  mapId?: string,
): DefenseMapDef {
  const id = mapId ?? registry.defaultMapId;
  return registry.maps.find((m) => m.id === id) ?? registry.maps[0]!;
}