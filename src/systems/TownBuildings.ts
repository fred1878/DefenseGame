import Phaser from "phaser";
import type { TownBuildingDef, TownLayoutDef } from "../core/townBuildingTypes";

export type TownBuildingInstance = {
  sprite: Phaser.GameObjects.Image;
  buildingId: string;
  label: string;
};

/** Place layout slots as 1:1 native PNG footprints (feet at slot y). */
export function spawnTownBuildings(
  scene: Phaser.Scene,
  defs: Record<string, TownBuildingDef>,
  layout: TownLayoutDef,
  depth = 8,
): TownBuildingInstance[] {
  const out: TownBuildingInstance[] = [];
  for (const slot of layout.slots) {
    const def = defs[slot.buildingId];
    if (!def) {
      console.warn(`Town layout references unknown building: ${slot.buildingId}`);
      continue;
    }
    if (!scene.textures.exists(def.textureKey)) {
      console.warn(`Town building texture missing: ${def.textureKey}`);
      continue;
    }
    const sprite = scene.add
      .image(slot.x, slot.y, def.textureKey)
      .setOrigin(0.5, 1)
      .setDepth(depth);
    sprite.setDisplaySize(def.width, def.height);
    out.push({ sprite, buildingId: slot.buildingId, label: def.label });
  }
  return out;
}