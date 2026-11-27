import type { SaveGame } from "../core/saveTypes";
import { consumableKindCount, getConsumablesConfig } from "./consumables";
import type { ConsumableKind, ConsumablesConfig } from "./consumableTypes";

export type ConsumableButtonState = {
  visible: boolean;
  enabled: boolean;
  label: string;
};

const KIND_LABEL: Record<ConsumableKind, string> = {
  heal: "Potion",
  bomb: "Bomb",
};

/** HUD button look: hidden with no charges, dimmed while cooling down. */
export function consumableButtonState(
  save: SaveGame,
  kind: ConsumableKind,
  nowMs: number,
  readyAtMs: number,
  config: ConsumablesConfig = getConsumablesConfig(),
): ConsumableButtonState {
  const count = consumableKindCount(save, kind, config);
  return {
    visible: count > 0,
    enabled: count > 0 && nowMs >= readyAtMs,
    label: `${KIND_LABEL[kind]} ×${count}`,
  };
}

export type BombTargetCandidate = { id: string; x: number; y: number };

/** Focused enemy when in range, else the nearest enemy in range, else null. */
export function pickBombTarget(
  from: { x: number; y: number },
  enemies: readonly BombTargetCandidate[],
  focusId: string | null,
  rangePx: number,
): BombTargetCandidate | null {
  const inRange = (e: BombTargetCandidate) =>
    Math.hypot(e.x - from.x, e.y - from.y) <= rangePx;
  const focus = focusId ? enemies.find((e) => e.id === focusId) : undefined;
  if (focus && inRange(focus)) return focus;
  let best: BombTargetCandidate | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const e of enemies) {
    const d = Math.hypot(e.x - from.x, e.y - from.y);
    if (d <= rangePx && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/** Hotkeys for desktop: Q drinks a potion, E throws a bomb. */
export function consumableKindForKey(key: string): ConsumableKind | null {
  const k = key.toLowerCase();
  if (k === "q") return "heal";
  if (k === "e") return "bomb";
  return null;
}
