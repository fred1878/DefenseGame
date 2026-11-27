import Phaser from "phaser";
import { TOWN_ISO_ATLAS, TOWN_ISO_TEXTURE } from "../content/townIsoAssets";
import type { TownBuildingDef, TownLayoutDef } from "../core/townBuildingTypes";
import { setContainerInputEnabled } from "../input/setContainerInputEnabled";
import { TOWN_ISO_VIEW } from "../config/townIsoView";
import {
  createTownPlate,
  type TownPlate,
  type TownPlateInfo,
} from "../ui/townBuildingPlate";
import { bindContainerPress } from "../ui/touchButton";
import {
  isoDepthForWorldY,
  isoScreenToWorld,
  isoWorldToScreen,
} from "../world/townIso/isoGrid";
import { TOWN_ISO_SPRITES } from "../world/townIso/townIsoStageData";
import type { TownIsoBuildingTier } from "../world/townIso/townIsoTypes";

/** Plates draw above the town world and under the HUD bars. */
const PLATE_DEPTH = 20;
/** Contact shadow under each tappable building (above ground/fog, below sprites). */
const SHADOW_DEPTH = 0.5;
const SHADOW_ALPHA = 0.85;

/** What a building shows: its art tier and its name plate. */
export type TownBuildingView = {
  tier: TownIsoBuildingTier;
  plate: TownPlateInfo;
};

export type TownBuildingControl = {
  container: Phaser.GameObjects.Container;
  buildingId: string;
  setInputEnabled: (enabled: boolean) => void;
  /** Swap art tier / refresh the name plate. */
  update: (view: TownBuildingView) => void;
  /** Tap point in game/canvas coords (centre of the sprite's tap box, for e2e taps). */
  spriteCenter: () => { x: number; y: number };
  /** Static art the town bakes into its world layer (see `TownIsoWorld.bake`). */
  bakeArt: () => TownBakeArt;
};

/** A building's static art: `key` changes whenever the drawn tier changes. */
export type TownBakeArt = {
  key: string;
  shadow: Phaser.GameObjects.Image;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  plate: TownPlate;
};

export type SpawnTownBuildingControlsOpts = {
  viewFor: (buildingId: string, def: TownBuildingDef) => TownBuildingView;
  onTap: (buildingId: string, def: TownBuildingDef) => void;
};

/**
 * Tap box (container space, foot at the origin) around a tier sprite drawn at `scale`.
 * The sprite's outer 15% each side is left out so neighbours overlap less; never smaller
 * than the building's `width` x `height` from town_buildings.json.
 */
export function townBuildingTapBox(
  tier: TownIsoBuildingTier,
  def: TownBuildingDef,
  scale: number,
): Phaser.Geom.Rectangle {
  const frame = TOWN_ISO_SPRITES[tier.key];
  const [ax, ay, w, h] = frame ?? [0, 0, 0, 0];
  const left = -ax * scale;
  const right = (w - ax) * scale;
  const inset = (right - left) * 0.15;
  const boxW = Math.max(def.width, right - left - inset * 2);
  const boxH = Math.max(def.height, h * scale);
  const cx = (left + right) / 2;
  return new Phaser.Geom.Rectangle(
    cx - boxW / 2,
    -ay * scale + (h * scale - boxH),
    boxW,
    boxH,
  );
}

/** Screen position of a tier's foot for a layout slot (slot x/y are screen px). */
export function townBuildingFootScreen(
  slot: { x: number; y: number },
  tier: TownIsoBuildingTier,
): { x: number; y: number; worldY: number } {
  const w = isoScreenToWorld(slot.x, slot.y);
  const s = isoWorldToScreen(w.x + tier.dx, w.y + tier.dy);
  return { x: s.x, y: s.y, worldY: w.y + tier.dy };
}

/**
 * Isometric town buildings: full-colour lit sprite (no outline or glow), a soft contact
 * shadow and a crest name plate. Sprite and plate are both tap targets.
 */
export function spawnTownBuildingControls(
  scene: Phaser.Scene,
  defs: Record<string, TownBuildingDef>,
  layout: TownLayoutDef,
  opts: SpawnTownBuildingControlsOpts,
): TownBuildingControl[] {
  const out: TownBuildingControl[] = [];
  const scale = TOWN_ISO_VIEW.scale * layout.buildingDisplayScale;

  for (const slot of layout.slots) {
    const def = defs[slot.buildingId];
    if (!def) {
      console.warn(
        `Town layout references unknown building: ${slot.buildingId}`,
      );
      continue;
    }
    const buildingId = slot.buildingId;
    const first = opts.viewFor(buildingId, def);
    const container = scene.add.container(0, 0);
    const sprite = scene.add.image(0, 0, TOWN_ISO_ATLAS.lit, first.tier.key);
    container.add(sprite);
    const shadow = scene.add
      .image(0, 0, TOWN_ISO_TEXTURE.light)
      .setTint(0x000000)
      .setAlpha(SHADOW_ALPHA)
      .setDepth(SHADOW_DEPTH);

    const plate: TownPlate = createTownPlate(
      scene,
      0,
      0,
      first.plate,
      PLATE_DEPTH,
    );
    let tapBox = townBuildingTapBox(first.tier, def, scale);
    let foot = townBuildingFootScreen(slot, first.tier);
    let tierKey = first.tier.key;

    const update = (view: TownBuildingView): void => {
      const t = view.tier;
      const frame = TOWN_ISO_SPRITES[t.key];
      const [ax, ay, w, h] = frame ?? [0, 0, 1, 1];
      foot = townBuildingFootScreen(slot, t);
      tierKey = t.key;
      container
        .setPosition(foot.x, foot.y)
        .setDepth(isoDepthForWorldY(foot.worldY));
      sprite
        .setTexture(TOWN_ISO_ATLAS.lit, t.key)
        .setOrigin(ax / w, ay / h)
        .setScale(scale);
      const [fa, fb] = t.footprint;
      // Footprint diamond: foot = bottom corner; centre sits (fb - fa) * 16, (fa + fb) * 8 away.
      shadow
        .setPosition(
          foot.x + 16 * (fb - fa) * TOWN_ISO_VIEW.scale,
          foot.y - 8 * (fa + fb) * TOWN_ISO_VIEW.scale,
        )
        .setDisplaySize(
          36 * (fa + fb) * TOWN_ISO_VIEW.scale,
          18 * (fa + fb) * TOWN_ISO_VIEW.scale,
        );
      tapBox = townBuildingTapBox(t, def, scale);
      if (container.input?.hitArea) {
        const r = container.input.hitArea as Phaser.Geom.Rectangle;
        r.x = tapBox.x;
        r.y = tapBox.y;
        r.width = tapBox.width;
        r.height = tapBox.height;
      }
      plate.moveTo(foot.x, foot.y + 4);
      plate.update(view.plate);
    };
    update(first);

    container.setInteractive(tapBox, Phaser.Geom.Rectangle.Contains);
    // No press tint/scale: the art is baked into the world layer and the tap opens its panel
    // on pointerdown anyway.
    bindContainerPress(scene, container, () => opts.onTap(buildingId, def));
    const plateObj = plate.container;
    plate.makeTappable(() => opts.onTap(buildingId, def));

    container.setData("testid", `town-building-${buildingId}`);
    if (def.startsNight) {
      container.setData("testid", "start-night");
    }

    out.push({
      container,
      buildingId,
      setInputEnabled: (enabled: boolean) => {
        setContainerInputEnabled(container, enabled);
        setContainerInputEnabled(plateObj, enabled);
      },
      update,
      spriteCenter: () => ({
        x: foot.x + tapBox.x + tapBox.width / 2,
        y: foot.y + tapBox.y + tapBox.height / 2,
      }),
      bakeArt: () => ({
        key: `${buildingId}:${tierKey}`,
        shadow,
        container,
        sprite,
        plate,
      }),
    });
  }

  return out;
}
