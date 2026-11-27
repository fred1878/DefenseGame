import { tuning } from "../tuning/gameTuning";
import type { DataStore } from "../core/data/DataStore";
import type { SaveGame } from "../core/save/saveTypes";
import type { TownBuildingDef } from "../core/data/townBuildingTypes";
import { wallHpBonusFromBuildings } from "../core/save/GameState";
import type { BuildingDef } from "../core/data/DataStore";
import {
  type EconomyPolicy,
  hasEnoughGold,
  spendGold,
} from "../core/economyPolicy";

import type { TownPlateInfo } from "../ui/hud/townBuildingPlate";

function upgradeEffectLabel(effect: string): string {
  if (effect === "wallHpMax") return "Wall HP";
  if (effect === "shopLevel") return "Shop";
  return effect;
}

/** Short action on a building's name plate (what a tap does). */
function townBuildingAction(def: TownBuildingDef): string {
  if (def.startsNight) return "Start night";
  if (def.opensSpellBar) return "Spells";
  if (def.opensEndlessMode) return "Endless";
  if (def.opensWavePlanner) return "Wave plan";
  if (def.opensSaveMenu) return "Save";
  if (def.opensShop === "trader") return "Trader";
  if (def.opensShop === "blacksmith") return "Blacksmith";
  if (def.upgradeId === "wall") return "Wall";
  if (def.upgradeId) return "Upgrade";
  return "Not available yet";
}

/**
 * Name plate for a town building: name, level / max for buildings with an upgrade or shop
 * level (`buildings.json`), the tap action, and whether the next level is affordable.
 */
export function townBuildingPlateInfo(
  store: DataStore,
  save: SaveGame,
  def: TownBuildingDef,
  policy?: EconomyPolicy,
): TownPlateInfo {
  const info: TownPlateInfo = {
    name: def.label,
    action: townBuildingAction(def),
  };
  const id = def.upgradeId ?? def.opensShop;
  const up = id ? store.buildings[id] : undefined;
  if (!id || !up) return info;
  const level = save.buildings[id] ?? 0;
  const cost = up.costByLevel[level];
  return {
    ...info,
    level,
    maxLevel: up.maxLevel,
    upgradeReady:
      level < up.maxLevel &&
      cost !== undefined &&
      hasEnoughGold(save, cost, policy),
  };
}

export type TownBuildingTapResult =
  | { kind: "noop"; message: string }
  | { kind: "upgraded"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "startNight"; message: string }
  | { kind: "openSpellBar"; message: string }
  | { kind: "openEndlessMode"; message: string }
  | { kind: "openWavePlanner"; message: string }
  | { kind: "openSaveMenu"; message: string }
  | { kind: "openShop"; shop: "trader" | "blacksmith"; message: string };

/** Tap handler for a town building menu row (upgrade when wired, else status-only). */
export function handleTownBuildingTap(
  store: DataStore,
  save: SaveGame,
  def: TownBuildingDef,
  policy?: EconomyPolicy,
): { save: SaveGame; result: TownBuildingTapResult } {
  if (def.startsNight) {
    return { save, result: { kind: "startNight", message: "" } };
  }
  if (def.opensSpellBar) {
    return { save, result: { kind: "openSpellBar", message: "" } };
  }
  if (def.opensEndlessMode) {
    return { save, result: { kind: "openEndlessMode", message: "" } };
  }
  if (def.opensWavePlanner) {
    return { save, result: { kind: "openWavePlanner", message: "" } };
  }
  if (def.opensSaveMenu) {
    return { save, result: { kind: "openSaveMenu", message: "" } };
  }
  if (def.opensShop) {
    return {
      save,
      result: { kind: "openShop", shop: def.opensShop, message: "" },
    };
  }

  const upgradeId = def.upgradeId;
  if (!upgradeId) {
    return {
      save,
      result: {
        kind: "noop",
        message: `${def.label} — not available yet`,
      },
    };
  }

  const up = store.buildings[upgradeId];
  if (!up) {
    return {
      save,
      result: { kind: "noop", message: `${def.label} — not available yet` },
    };
  }

  const attempt = tryApplyBuildingUpgrade(save, up, upgradeId, policy);
  return attempt;
}

/**
 * Buy the next upgrade level of a shop (`buildings.json` trader / blacksmith).
 * The shop's stock for the day is cleared so it restocks at the new level.
 */
export function upgradeShop(
  buildings: Readonly<Record<string, BuildingDef>>,
  save: SaveGame,
  shop: "trader" | "blacksmith",
  policy?: EconomyPolicy,
): { save: SaveGame; result: TownBuildingTapResult } {
  const up = buildings[shop];
  if (!up) {
    return {
      save,
      result: { kind: "blocked", message: "Upgrade unavailable" },
    };
  }
  const attempt = tryApplyBuildingUpgrade(save, up, shop, policy);
  if (attempt.result.kind !== "upgraded") return attempt;
  return {
    save: {
      ...attempt.save,
      shops: { ...attempt.save.shops, [shop]: null },
    },
    result: attempt.result,
  };
}

function tryApplyBuildingUpgrade(
  save: SaveGame,
  def: BuildingDef,
  id: string,
  policy?: EconomyPolicy,
): { save: SaveGame; result: TownBuildingTapResult } {
  const level = save.buildings[id] ?? 0;
  if (level >= def.maxLevel) {
    return {
      save,
      result: {
        kind: "blocked",
        message: `${upgradeEffectLabel(def.effect)} — max level`,
      },
    };
  }
  const cost = def.costByLevel[level];
  if (cost === undefined) {
    return {
      save,
      result: { kind: "blocked", message: "Upgrade unavailable" },
    };
  }
  if (!hasEnoughGold(save, cost, policy)) {
    return {
      save,
      result: {
        kind: "blocked",
        message: `Need ${cost}g (have ${save.gold}g)`,
      },
    };
  }

  const next: SaveGame = {
    ...save,
    gold: spendGold(save.gold, cost, policy),
    buildings: { ...save.buildings, [id]: level + 1 },
  };
  if (def.effect === "wallHpMax") {
    const prevMax = save.townWallHpMax;
    const bonus = wallHpBonusFromBuildings(next.buildings);
    const max = tuning("gameplay").wall.baseHp + bonus;
    const maxDelta = max - prevMax;
    next.townWallHpMax = max;
    // Same HP bonus applied to current wall HP (not just the cap).
    next.townWallHp = Math.min(max, save.townWallHp + maxDelta);
  }

  let message = `Upgraded to L${level + 1}`;
  if (def.effect === "wallHpMax") {
    message = `Wall L${level + 1} · HP ${next.townWallHp}/${next.townWallHpMax}`;
  }

  return { save: next, result: { kind: "upgraded", message } };
}
