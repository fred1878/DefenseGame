import bundledItems from "../../public/data/items.json";
import { normalizeItems } from "../core/normalizeItems";
import type { GearCatalog } from "./gearTypes";

let activeCatalog: GearCatalog | null = null;

/** Replace the item catalog after `public/data/items.json` loads (Boot). */
export function setGearCatalog(catalog: GearCatalog): void {
  activeCatalog = catalog;
}

/** Active catalog; falls back to the bundled `items.json` before Boot (tests, early save reads). */
export function getGearCatalog(): GearCatalog {
  if (!activeCatalog) activeCatalog = normalizeItems(bundledItems);
  return activeCatalog;
}
