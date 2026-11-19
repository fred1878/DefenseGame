import { OBSTACLE_TEXTURE, type ObstacleTextureKey } from "../content/assets";
import type { DefenseObstaclePlacement } from "../config/defense";
import {
  ConfigLoadError,
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";

const VALID_TEXTURE_KEYS = new Set<string>(Object.values(OBSTACLE_TEXTURE));

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

function requireTextureKey(
  raw: unknown,
  path: string,
): ObstacleTextureKey {
  if (typeof raw !== "string" || !VALID_TEXTURE_KEYS.has(raw)) {
    throw new ConfigLoadError(`Missing or invalid textureKey at ${path}`);
  }
  return raw as ObstacleTextureKey;
}

function normalizePlacement(
  row: DefenseMapObstacleInput,
  path: string,
): DefenseObstaclePlacement {
  const block = requireRecord(row, path);
  return {
    tileX: requireFiniteNumber(block.tileX, `${path}.tileX`),
    tileY: requireFiniteNumber(block.tileY, `${path}.tileY`),
    textureKey: requireTextureKey(block.textureKey, `${path}.textureKey`),
  };
}

function normalizeMap(row: DefenseMapInput, index: number): DefenseMapDef {
  const path = `defense-maps.maps[${index}]`;
  const block = requireRecord(row, path);
  const idRaw = block.id;
  if (typeof idRaw !== "string" || !idRaw.trim()) {
    throw new ConfigLoadError(`Missing string at ${path}.id`);
  }
  const field = requireRecord(block.field, `${path}.field`);
  const cols = requireFiniteNumber(field.cols, `${path}.field.cols`);
  const rows = requireFiniteNumber(field.rows, `${path}.field.rows`);
  if (cols < 1 || rows < 1) {
    throw new ConfigLoadError(`Invalid field size at ${path}.field`);
  }
  const obstaclesRaw = block.obstacles;
  if (!Array.isArray(obstaclesRaw) || obstaclesRaw.length === 0) {
    throw new ConfigLoadError(`Expected non-empty obstacles at ${path}.obstacles`);
  }
  const obstacles = obstaclesRaw.map((o, i) =>
    normalizePlacement(o as DefenseMapObstacleInput, `${path}.obstacles[${i}]`),
  );
  return {
    id: idRaw.trim(),
    field: { cols, rows },
    obstacles,
  };
}

export function normalizeDefenseMaps(
  raw: DefenseMapsFileInput | null | undefined,
): DefenseMapsRegistry {
  const root = requireRecord(raw, "defense-maps");
  const mapsRaw = root.maps;
  if (!Array.isArray(mapsRaw) || mapsRaw.length === 0) {
    throw new ConfigLoadError("defense-maps.maps must be a non-empty array");
  }
  const maps = mapsRaw.map((m, i) => normalizeMap(m as DefenseMapInput, i));
  const defaultMapIdRaw = root.defaultMapId;
  if (typeof defaultMapIdRaw !== "string" || !defaultMapIdRaw.trim()) {
    throw new ConfigLoadError("Missing string at defense-maps.defaultMapId");
  }
  const defaultMapId = defaultMapIdRaw.trim();
  if (!maps.some((m) => m.id === defaultMapId)) {
    throw new ConfigLoadError(
      `defense-maps.defaultMapId "${defaultMapId}" not found in maps`,
    );
  }
  return { defaultMapId, maps };
}

export function resolveDefenseMap(
  registry: DefenseMapsRegistry,
  mapId?: string,
): DefenseMapDef {
  const id = mapId ?? registry.defaultMapId;
  const found = registry.maps.find((m) => m.id === id);
  if (!found) {
    throw new ConfigLoadError(`Defense map id not found: ${id}`);
  }
  return found;
}