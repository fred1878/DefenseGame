import type Phaser from "phaser";
import type { DataStore } from "../../core/data/DataStore";
import type { TownBuildingControl } from "./TownBuildings";
import type { TownOverlays } from "./TownOverlays";
import {
  interactiveObjectScreenRect,
  isTouchButtonVisuallyPressed,
} from "../../ui/touch/touchButton";
import { clampEndlessConcurrent } from "../../core/endlessLimits";
import type { EndlessRunSelection } from "../../core/defenseRunMode";

/**
 * Building, header-button and open-overlay tap targets keyed by e2e test id.
 * `header` lists the header buttons to include (empty while a modal is up).
 */
export function collectTownUiTapTargets(
  store: DataStore,
  buildingControls: ReadonlyMap<string, TownBuildingControl>,
  overlays: TownOverlays,
  header: ReadonlyArray<readonly [string, Phaser.GameObjects.GameObject]> = [],
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, control] of buildingControls) {
    const pt = control.spriteCenter();
    out[`town-building-${id}`] = pt;
    const def = store.townBuildings[id];
    if (def?.startsNight) {
      out["start-night"] = pt;
    }
  }
  overlays.collectE2eTapTargets(out);
  for (const [id, obj] of header) {
    const r = interactiveObjectScreenRect(obj);
    if (r) out[id] = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }
  return out;
}

/** One-enemy endless run at the panel's default concurrency (E2E start). */
export function e2eEndlessSelections(
  store: DataStore,
  enemyId: string,
): EndlessRunSelection[] {
  const cap = clampEndlessConcurrent(
    store.player.endlessPanelDefaultConcurrent,
  );
  return [{ enemyId, concurrentCap: cap }];
}

export function isTownTouchButtonPressed(
  buildingControls: ReadonlyMap<string, TownBuildingControl>,
  testId: string,
): boolean {
  if (testId === "start-night") {
    const btn = buildingControls.get("town_special_gallows_square");
    return btn ? isTouchButtonVisuallyPressed(btn.container) : false;
  }
  return false;
}
