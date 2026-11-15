import Phaser from "phaser";
import { clampRenderResolution, scaleUiX, scaleUiY } from "../core/displayScale";
import type { TownBuildingDef, TownLayoutDef } from "../core/townBuildingTypes";
import { bindContainerPress } from "../ui/touchButton";

export type TownBuildingControl = {
  container: Phaser.GameObjects.Container;
  buildingId: string;
  setLabel: (text: string) => void;
  /** Building center in game/canvas coords (for e2e taps). */
  spriteCenter: () => { x: number; y: number };
};

export type SpawnTownBuildingControlsOpts = {
  depth?: number;
  labelFor: (def: TownBuildingDef) => string;
  onTap: (buildingId: string, def: TownBuildingDef) => void;
};

function textResolution(scene: Phaser.Scene): number {
  return (
    (scene.registry.get("renderResolution") as number | undefined) ??
    clampRenderResolution()
  );
}

/** Layout slot buildings: sprite art + overlay label, full footprint is the tap target. */
export function spawnTownBuildingControls(
  scene: Phaser.Scene,
  defs: Record<string, TownBuildingDef>,
  layout: TownLayoutDef,
  opts: SpawnTownBuildingControlsOpts,
): TownBuildingControl[] {
  const depth = opts.depth ?? 24;
  const tapPad = scaleUiX(8);
  const out: TownBuildingControl[] = [];

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

    const footX = slot.x;
    const footY = slot.y;
    const hitW = def.width + tapPad * 2;
    const hitH = def.height + tapPad;

    const container = scene.add
      .container(footX, footY)
      .setDepth(depth);

    const sprite = scene.add
      .image(0, 0, def.textureKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(def.width, def.height);

    const labelBandH = scaleUiY(26);
    const labelInset = scaleUiY(4);
    const labelY = -labelInset - labelBandH / 2;
    const labelW = def.width - scaleUiX(4);
    const backing = scene.add
      .rectangle(0, labelY, labelW, labelBandH, 0x0f1118, 0.72)
      .setStrokeStyle(Math.max(1, scaleUiX(1)), 0x3f3f46, 0.9);

    const fontSize = `${scaleUiX(8)}px`;
    const labelText = opts.labelFor(def);
    const text = scene.add
      .text(0, labelY, labelText, {
        fontSize,
        color: "#f4f4f5",
        stroke: "#0c0c0e",
        strokeThickness: Math.max(1, scaleUiX(1)),
        align: "center",
        wordWrap: { width: labelW - scaleUiX(4), useAdvancedWrap: true },
        lineSpacing: -scaleUiY(2),
        resolution: textResolution(scene),
      })
      .setOrigin(0.5, 0.5)
      .setMaxLines(2);

    const labelMask = backing.createBitmapMask();
    text.setMask(labelMask);

    container.add([sprite, backing, text]);

    // Feet at container origin: hit box spans the full sprite footprint.
    container.setInteractive(
      new Phaser.Geom.Rectangle(
        -hitW / 2,
        -hitH,
        hitW,
        hitH,
      ),
      Phaser.Geom.Rectangle.Contains,
    );

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
      y: footY - def.height / 2,
    });

    out.push({
      container,
      buildingId: slot.buildingId,
      setLabel: (next: string) => text.setText(next),
      spriteCenter,
    });
  }

  return out;
}