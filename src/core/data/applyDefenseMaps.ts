import {
  normalizeDefenseMaps,
  resolveDefenseMap,
  type DefenseMapsFileInput,
} from "./normalizeDefenseMaps";
import { applyDefenseMapLayout } from "../../config/defense";

/** Load map registry from JSON and apply its default layout. */
export function applyDefenseMaps(
  raw: DefenseMapsFileInput | null | undefined,
): void {
  const registry = normalizeDefenseMaps(raw);
  const map = resolveDefenseMap(registry, registry.defaultMapId);
  applyDefenseMapLayout(map.field, map.obstacles);
}
