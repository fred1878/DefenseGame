import type { DataStore } from "../../core/DataStore";
import type { TownBuildingControl } from "../../systems/TownBuildings";
import { isTouchButtonVisuallyPressed } from "../../ui/touchButton";
import type { TownOverlays } from "./TownOverlays";

/** Building + open-overlay tap targets keyed by e2e test id. */
export function collectTownUiTapTargets(
  store: DataStore,
  buildingControls: ReadonlyMap<string, TownBuildingControl>,
  overlays: TownOverlays,
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
  return out;
}

export function isTownTouchButtonPressed(
  buildingControls: ReadonlyMap<string, TownBuildingControl>,
  testId: string,
): boolean {
  if (testId === "start-night") {
    const btn = buildingControls.get("town_special_gallows_square");
    return btn
      ? isTouchButtonVisuallyPressed(btn.container)
      : false;
  }
  return false;
}
