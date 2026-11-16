import type { DataStore } from "../core/DataStore";
import type { SaveGame } from "../core/saveTypes";
import type { TownBuildingDef } from "../core/townBuildingTypes";
import { playerDamageMult, wallHpBonusFromBuildings } from "../core/GameState";
import type { BuildingDef } from "../core/DataStore";

const UNIMPLEMENTED_SUBTITLE = "— Not available yet";
const START_NIGHT_SUBTITLE = "— Start night";
const SPELL_BAR_SUBTITLE = "— Spell bar";
const ENDLESS_MODE_SUBTITLE = "— Endless training";

function upgradeEffectLabel(effect: string): string {
  if (effect === "wallHpMax") return "Wall HP";
  if (effect === "playerDamage") return "Player damage";
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
    const next =
      cost !== undefined ? `, next ${cost}g` : "";
    return `— Upgrade wall (L${level}${next})`;
  }
  if (upgradeId === "blacksmith") {
    const dmg = playerDamageMult(save.buildings).toFixed(2);
    if (level >= up.maxLevel) {
      return `— Smith max (L${level}, damage x${dmg})`;
    }
    const cost = up.costByLevel[level];
    const next =
      cost !== undefined ? `, next ${cost}g` : "";
    return `— Upgrade smith (L${level}, damage x${dmg}${next})`;
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
  | { kind: "openEndlessMode"; message: string };

/** Tap handler for a town building menu row (upgrade when wired, else status-only). */
export function handleTownBuildingTap(
  store: DataStore,
  save: SaveGame,
  def: TownBuildingDef,
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

  const attempt = tryApplyBuildingUpgrade(save, up, upgradeId);
  return attempt;
}

function tryApplyBuildingUpgrade(
  save: SaveGame,
  def: BuildingDef,
  id: string,
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
  if (save.gold < cost) {
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
    const bonus = wallHpBonusFromBuildings(next.buildings);
    const max = 100 + bonus;
    next.townWallHpMax = max;
    next.townWallHp = Math.min(next.townWallHp, max);
  }

  const smith = next.buildings.blacksmith ?? 0;
  const dmg = playerDamageMult(next.buildings).toFixed(2);
  let message = `Upgraded to L${level + 1}`;
  if (def.effect === "wallHpMax") {
    message = `Wall L${level + 1} · HP ${next.townWallHp}/${next.townWallHpMax}`;
  } else if (def.effect === "playerDamage") {
    message = `Blacksmith L${smith} · damage x${dmg}`;
  }

  return { save: next, result: { kind: "upgraded", message } };
}