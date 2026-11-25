import Phaser from "phaser";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { TownBuildingDef, TownLayoutDef } from "../core/townBuildingTypes";
import { setContainerInputEnabled } from "../input/setContainerInputEnabled";
import { bindContainerPress } from "../ui/touchButton";
import { uiSmallLabelShadow, uiTextStyle } from "../ui/uiTextStyle";

function townBuildingDisplayWidth(
  def: TownBuildingDef,
  buildingDisplayScale: number,
): number {
  return def.width * buildingDisplayScale;
}

function townBuildingDisplayHeight(
  def: TownBuildingDef,
  buildingDisplayScale: number,
): number {
  return def.height * buildingDisplayScale;
}

export type TownBuildingControl = {
  container: Phaser.GameObjects.Container;
  buildingId: string;
  setInputEnabled: (enabled: boolean) => void;
  setLabel: (text: string) => void;
  /** Building center in game/canvas coords (for e2e taps). */
  spriteCenter: () => { x: number; y: number };
};

export type SpawnTownBuildingControlsOpts = {
  depth?: number;
  labelFor: (def: TownBuildingDef) => string;
  onTap: (buildingId: string, def: TownBuildingDef) => void;
};

export function townBuildingLabelWrapWidth(def: TownBuildingDef): number {
  return Math.max(def.width, scaleUiX(136));
}

/** Interactive hit box in container space (feet at origin, origin 0,0). */
export function townBuildingFootprintHitArea(
  def: TownBuildingDef,
  buildingDisplayScale: number,
): Phaser.Geom.Rectangle {
  const width = townBuildingDisplayWidth(def, buildingDisplayScale);
  const height = townBuildingDisplayHeight(def, buildingDisplayScale);
  return new Phaser.Geom.Rectangle(-width / 2, -height, width, height);
}

function townBuildingOverlayLabelStyle(
  scene: Phaser.Scene,
  wrapWidth: number,
): Phaser.Types.GameObjects.Text.TextStyle {
  const fontPx = scaleUiX(12);
  return uiTextStyle(scene, {
    fontSize: `${fontPx}px`,
    color: "#fafafa",
    align: "center",
    wordWrap: { width: wrapWidth, useAdvancedWrap: true },
    lineSpacing: scaleUiY(2),
    shadow: uiSmallLabelShadow(),
  });
}

/** Layout slot buildings: sprite art + overlay label, full footprint is the tap target. */
export function spawnTownBuildingControls(
  scene: Phaser.Scene,
  defs: Record<string, TownBuildingDef>,
  layout: TownLayoutDef,
  opts: SpawnTownBuildingControlsOpts,
): TownBuildingControl[] {
  const depth = opts.depth ?? 24;
  const out: TownBuildingControl[] = [];

  const buildingDisplayScale = layout.buildingDisplayScale;

  for (const slot of layout.slots) {
    const def = defs[slot.buildingId];
    if (!def) {
      console.warn(
        `Town layout references unknown building: ${slot.buildingId}`,
      );
      continue;
    }
    if (!scene.textures.exists(def.textureKey)) {
      console.warn(`Town building texture missing: ${def.textureKey}`);
      continue;
    }

    const footX = slot.x;
    const footY = slot.y;

    const container = scene.add.container(footX, footY).setDepth(depth);

    const sprite = scene.add
      .image(0, 0, def.textureKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(
        townBuildingDisplayWidth(def, buildingDisplayScale),
        townBuildingDisplayHeight(def, buildingDisplayScale),
      );

    const labelWrap = townBuildingLabelWrapWidth(def);
    const labelY = -scaleUiY(4);
    const labelText = opts.labelFor(def);
    const text = scene.add
      .text(
        0,
        labelY,
        labelText,
        townBuildingOverlayLabelStyle(scene, labelWrap - scaleUiX(6)),
      )
      .setOrigin(0.5, 1);

    container.add([sprite, text]);

    const hitArea = townBuildingFootprintHitArea(def, buildingDisplayScale);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    bindContainerPress(
      scene,
      container,
      () => opts.onTap(slot.buildingId, def),
      {
        bg: sprite,
        colors: { rest: 0xffffff, pressed: 0xb8b8b8 },
        pressScale: 0.96,
        textured: true,
      },
    );

    container.setData("testid", `town-building-${slot.buildingId}`);
    if (def.startsNight) {
      container.setData("testid", "start-night");
    }

    const spriteCenter = (): { x: number; y: number } => ({
      x: footX,
      y: footY - townBuildingDisplayHeight(def, buildingDisplayScale) / 2,
    });

    out.push({
      container,
      buildingId: slot.buildingId,
      setInputEnabled: (enabled: boolean) =>
        setContainerInputEnabled(container, enabled),
      setLabel: (next: string) => text.setText(next),
      spriteCenter,
    });
  }

  return out;
}
