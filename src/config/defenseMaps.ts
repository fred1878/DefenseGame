import { ConfigLoadError } from "../core/configValidation";
import {
  normalizeDefenseMaps,
  resolveDefenseMap,
  type DefenseMapsFileInput,
  type DefenseMapsRegistry,
} from "../core/normalizeDefenseMaps";
import { applyDefenseMapLayout } from "./defense";

let activeRegistry: DefenseMapsRegistry | null = null;
let activeMapId: string | null = null;

/** Load map registry from JSON and apply the default (or selected) layout. */
export function applyDefenseMaps(raw: DefenseMapsFileInput | null | undefined): void {
  activeRegistry = normalizeDefenseMaps(raw);
  activeMapId = activeRegistry.defaultMapId;
  const map = resolveDefenseMap(activeRegistry, activeMapId);
  applyDefenseMapLayout(map.field, map.obstacles);
}

/** Read-only registry after Boot (for UI / future map picker). */
export function getDefenseMapsRegistry(): DefenseMapsRegistry {
  if (!activeRegistry) {
    throw new ConfigLoadError(
      "Defense maps not loaded — Boot must apply public/data/defense-maps.json",
    );
  }
  return activeRegistry;
}

export function getActiveDefenseMapId(): string {
  if (!activeMapId) {
    throw new ConfigLoadError(
      "Defense maps not loaded — Boot must apply public/data/defense-maps.json",
    );
  }
  return activeMapId;
}

/** Switch active layout without reloading JSON (future night modes / map select). */
export function selectDefenseMapId(mapId: string): boolean {
  const registry = getDefenseMapsRegistry();
  if (!registry.maps.some((m) => m.id === mapId)) return false;
  activeMapId = mapId;
  const map = resolveDefenseMap(registry, mapId);
  applyDefenseMapLayout(map.field, map.obstacles);
  return true;
}