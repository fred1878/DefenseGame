import type { SaveGame } from "../core/save/saveTypes";
import { getGearCatalog } from "../gear/gearCatalog";
import { applyGearLoadout } from "../gear/gearRuntime";
import type { GearCatalog, StatBonus } from "../gear/gearTypes";
import type { GearStats } from "../gear/itemStats";
import { getTalentCatalog } from "./talentCatalog";
import { talentBonus } from "./talentLogic";
import type { TalentCatalog } from "./talentTypes";

/** Learned talents of a save as a gear stat bonus. */
export function saveTalentBonus(
  save: Pick<SaveGame, "talents">,
  catalog: TalentCatalog = getTalentCatalog(),
): StatBonus {
  // e2e `setSave` may inject partial saves without a talents block.
  if (!save.talents) return { modifiers: [], procs: [] };
  return talentBonus(catalog, save.talents);
}

/** Apply equipped gear plus learned talents (combat stats, player tuning). */
export function applySaveLoadout(
  save: Pick<SaveGame, "gear" | "talents">,
  gearCatalog: GearCatalog = getGearCatalog(),
  talentCatalog: TalentCatalog = getTalentCatalog(),
): GearStats {
  return applyGearLoadout(
    save.gear,
    gearCatalog,
    saveTalentBonus(save, talentCatalog),
  );
}
