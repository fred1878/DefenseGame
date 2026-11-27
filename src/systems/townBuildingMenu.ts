import type { DataStore } from "../core/DataStore";
import type { SaveGame } from "../core/saveTypes";
import type { TownBuildingDef } from "../core/townBuildingTypes";
import { wallHpBonusFromBuildings } from "../core/GameState";
import type { BuildingDef } from "../core/DataStore";
import { type EconomyPolicy, hasEnoughGold } from "../core/economyPolicy";

const UNIMPLEMENTED_SUBTITLE = "— Not available yet";
const START_NIGHT_SUBTITLE = "— Start night";
const SPELL_BAR_SUBTITLE = "— Spell bar";
const ENDLESS_MODE_SUBTITLE = "— Endless training";
const WAVE_PLANNER_SUBTITLE = "— Wave planner";
const SAVE_MENU_SUBTITLE = "— Saves";
const SHOP_SUBTITLE = { trader: "— Trader", blacksmith: "— Blacksmith" };

function upgradeEffectLabel(effect: string): string {
  if (effect === "wallHpMax") return "Wall HP";
  if (effect === "shopLevel") return "Shop";
  return effect;
}

/** Second line under the building name on town menu buttons. */
export function townBuildingSubtitle(
  store: DataStore,
  save: SaveGame,
  def: TownBuildingDef,
): string {
  if (def.startsNight) return START_NIGHT_SUBTITLE;
  if (def.opensSpellBar) return SPELL_BAR_SUBTITLE;
  if (def.opensEndlessMode) return ENDLESS_MODE_SUBTITLE;
  if (def.opensWavePlanner) return WAVE_PLANNER_SUBTITLE;
  if (def.opensSaveMenu) return SAVE_MENU_SUBTITLE;
  if (def.opensShop) {
    const level = save.buildings[def.opensShop] ?? 0;
    return level > 0
      ? `${SHOP_SUBTITLE[def.opensShop]} L${level}`
      : SHOP_SUBTITLE[def.opensShop];
  }

  const upgradeId = def.upgradeId;
  if (!upgradeId) return UNIMPLEMENTED_SUBTITLE;

  const up = store.buildings[upgradeId];
  if (!up) return UNIMPLEMENTED_SUBTITLE;

  const level = save.buildings[upgradeId] ?? 0;
  if (upgradeId === "wall") {
    if (level >= up.maxLevel) {
      return `— Wall max (L${level}, HP ${save.townWallHp}/${save.townWallHpMax})`;
    }
    const cost = up.costByLevel[level];
    const next = cost !== undefined ? `, next ${cost}g` : "";
    return `— Upgrade wall (L${level}${next})`;
  }

  if (level >= up.maxLevel) {
    return `— ${upgradeEffectLabel(up.effect)} · max level`;
  }
  const cost = up.costByLevel[level];
  if (cost === undefined) return `— ${upgradeEffectLabel(up.effect)}`;
  return `— Upgrade (${upgradeId} L${level}, next ${cost}g)`;
}

export function formatTownBuildingButtonLabel(
  def: TownBuildingDef,
  subtitle: string,
): string {
  return `${def.label}\n${subtitle}`;
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
    gold: save.gold - cost,
    buildings: { ...save.buildings, [id]: level + 1 },
  };
  if (def.effect === "wallHpMax") {
    const prevMax = save.townWallHpMax;
    const bonus = wallHpBonusFromBuildings(next.buildings);
    const max = 100 + bonus;
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
