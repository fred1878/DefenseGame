import {
  codeDefenseMapsRegistry,
  normalizeDefenseMaps,
  resolveDefenseMap,
  type DefenseMapsFileInput,
  type DefenseMapsRegistry,
} from "../core/normalizeDefenseMaps";
import { applyDefenseMapLayout } from "./defense";

let activeRegistry: DefenseMapsRegistry = codeDefenseMapsRegistry();
let activeMapId: string = activeRegistry.defaultMapId;

/** Load map registry from JSON and apply the default (or selected) layout. */
export function applyDefenseMaps(raw: DefenseMapsFileInput | null | undefined): void {
  activeRegistry = normalizeDefenseMaps(raw);
  activeMapId = activeRegistry.defaultMapId;
  const map = resolveDefenseMap(activeRegistry, activeMapId);
  applyDefenseMapLayout(map.field, map.obstacles);
}

/** Read-only registry after Boot (for UI / future map picker). */
export function getDefenseMapsRegistry(): DefenseMapsRegistry {
  return activeRegistry;
}

export function getActiveDefenseMapId(): string {
  return activeMapId;
}

/** Switch active layout without reloading JSON (future night modes / map select). */
export function selectDefenseMapId(mapId: string): boolean {
  if (!activeRegistry.maps.some((m) => m.id === mapId)) return false;
  activeMapId = mapId;
  const map = resolveDefenseMap(activeRegistry, mapId);
  applyDefenseMapLayout(map.field, map.obstacles);
  return true;
}