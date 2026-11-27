import bundledTalents from "../../public/data/talents.json";
import { normalizeTalents } from "../core/data/normalizeTalents";
import type { TalentCatalog } from "./talentTypes";

let activeCatalog: TalentCatalog | null = null;

/** Replace the talent tree after `public/data/talents.json` loads (Boot / sim). */
export function setTalentCatalog(catalog: TalentCatalog): void {
  activeCatalog = catalog;
}

/** Active tree; falls back to the bundled `talents.json` before Boot (tests, early save reads). */
export function getTalentCatalog(): TalentCatalog {
  if (!activeCatalog) activeCatalog = normalizeTalents(bundledTalents);
  return activeCatalog;
}
