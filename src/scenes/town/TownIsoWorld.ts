import Phaser from "phaser";
import { GAME } from "../../config";
import { TOWN_ISO_VIEW } from "../../config/townIsoView";
import { TOWN_ISO_ATLAS, TOWN_ISO_TEXTURE } from "../../content/townIsoAssets";
import {
  isoDepthForWorldY,
  isoWorldToScreen,
} from "../../world/townIso/isoGrid";
import { townIsoGroundTiles } from "../../world/townIso/townIsoGround";
import {
  TOWN_ISO_SPRITES,
  TOWN_ISO_STAGES,
} from "../../world/townIso/townIsoStageData";
import { createTownPlate } from "../../ui/townBuildingPlate";
import type {
  TownIsoLightColor,
  TownStageIndex,
} from "../../world/townIso/townIsoTypes";

/** Render depths of the town world layers (HUD and plates sit above 10). */
export const TOWN_ISO_DEPTH = {
  ground: 0.1,
  fog: 0.2,
  plot: 0.3,
  contactShadow: 0.5,
  // sprites: 1..2 by foot Y (isoDepthForWorldY)
  light: 2.5,
  smoke: 2.6,
  vignette: 2.8,
} as const;

const LIGHT_RGB: Readonly<Record<TownIsoLightColor, number>> = {
  warm: 0xffaa50,
  witch: 0x966eff,
  moon: 0x78beff,
  sick: 0x8ce678,
  gold: 0xffc86e,
};

/** Additive light strength per unit of the mockup's light `k`. */
const LIGHT_ALPHA = 0.42;
/** Smoke: puffs alive per chimney, lifetime (ms) and rise (world px). */
const SMOKE_PUFFS = 7;
const SMOKE_LIFE_MS = 4200;
const SMOKE_RISE = 170;

const TOWN_LOCKED_PLATE_DEPTH = 19;

/** Mockup "Empty plot" spot (screen px) shown locked until the next stage. */
export const TOWN_LOCKED_PLOT_SCREEN = { x: 282, y: 640 } as const;

type SmokePuff = {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  age: number;
  seed: number;
};

/** Scale a world-px sprite to the town camera. */
export const TOWN_ISO_SCALE = TOWN_ISO_VIEW.scale;

/**
 * Isometric town scenery for one growth stage: Antahonist ground tiles stamped into a render
 * texture, fog, desaturated scenery sprites (y-sorted), additive lights, chimney smoke and a
 * vignette. Tappable buildings are separate (`spawnTownBuildingControls`).
 */
export class TownIsoWorld {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private puffs: SmokePuff[] = [];
  private builtStage: TownStageIndex | null = null;
  private builtKey = "";

  constructor(private readonly scene: Phaser.Scene) {}

  get stage(): TownStageIndex | null {
    return this.builtStage;
  }

  /**
   * (Re)build the world for `stage`; a no-op when nothing changed. `unlockTownLevel` shows
   * the locked empty plot with its hint (null at the last stage).
   */
  build(stage: TownStageIndex, unlockTownLevel: number | null): void {
    const key = `${stage}:${unlockTownLevel}`;
    if (this.builtKey === key) return;
    this.clear();
    this.builtKey = key;
    this.builtStage = stage;
    const data = TOWN_ISO_STAGES[stage];
    if (!data) return;
    this.buildGround(stage);
    this.buildScenery(stage);
    this.buildLights(stage);
    for (const [x, y] of data.smoke) this.addSmokeSource(x, y);
    if (unlockTownLevel !== null) this.buildLockedPlot(unlockTownLevel);
    this.track(
      this.scene.add
        .image(0, 0, TOWN_ISO_TEXTURE.vignette)
        .setOrigin(0)
        .setDisplaySize(GAME.width, GAME.height)
        .setDepth(TOWN_ISO_DEPTH.vignette),
    );
  }

  /** Advance chimney smoke. */
  tick(deltaMs: number): void {
    for (const p of this.puffs) {
      p.age = (p.age + deltaMs) % SMOKE_LIFE_MS;
      this.placePuff(p);
    }
  }

  destroy(): void {
    this.clear();
    this.builtStage = null;
    this.builtKey = "";
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.puffs = [];
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.objects.push(obj);
    return obj;
  }

  /** Dashed diamond on the ground and a grey plate: "Empty plot · Unlocks at Town Lv N". */
  private buildLockedPlot(unlockTownLevel: number): void {
    const { x, y } = TOWN_LOCKED_PLOT_SCREEN;
    const hw = 58;
    const hh = 28;
    const g = this.track(
      this.scene.add.graphics().setDepth(TOWN_ISO_DEPTH.plot),
    );
    const pts = [
      [x, y - hh],
      [x + hw, y],
      [x, y + hh],
      [x - hw, y],
      [x, y - hh],
    ] as const;
    g.fillStyle(0x0a0a0e, 0.35);
    g.beginPath();
    g.moveTo(x, y - hh);
    g.lineTo(x + hw, y);
    g.lineTo(x, y + hh);
    g.lineTo(x - hw, y);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x8a8172, 1);
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = pts[i] as readonly [number, number];
      const [x1, y1] = pts[i + 1] as readonly [number, number];
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 0; d < len; d += 11) {
        const e = Math.min(len, d + 6);
        g.lineBetween(
          x0 + ((x1 - x0) * d) / len,
          y0 + ((y1 - y0) * d) / len,
          x0 + ((x1 - x0) * e) / len,
          y0 + ((y1 - y0) * e) / len,
        );
      }
    }
    const plate = createTownPlate(
      this.scene,
      x,
      y + hh + 4,
      {
        name: "Empty plot",
        action: `Unlocks at Town Lv ${unlockTownLevel}`,
        locked: true,
      },
      TOWN_LOCKED_PLATE_DEPTH,
    );
    this.track(plate.container);
  }

  private buildGround(stage: TownStageIndex): void {
    const data = TOWN_ISO_STAGES[stage];
    if (!data) return;
    const V = TOWN_ISO_VIEW;
    const rt = this.track(
      this.scene.add
        .renderTexture(0, 0, V.viewWidth, V.viewHeight)
        .setOrigin(0)
        .setScale(V.scale)
        .setDepth(TOWN_ISO_DEPTH.ground),
    );
    // Filter must be set before drawing: changing it afterwards recreates the GL texture and
    // wipes the stamped tiles.
    rt.texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
    rt.fill(0x0e0e12, 1);
    for (const t of townIsoGroundTiles(data.ground)) {
      rt.stamp(TOWN_ISO_ATLAS.ground, t.frame, t.x - V.viewX, t.y - V.viewY, {
        originX: 0,
        originY: 0,
      });
    }
    rt.render();
    const fogKey = TOWN_ISO_TEXTURE.fog[stage];
    this.track(
      this.scene.add
        .image(0, 0, fogKey)
        .setOrigin(0)
        .setDisplaySize(GAME.width, GAME.height)
        .setDepth(TOWN_ISO_DEPTH.fog),
    );
  }

  private buildScenery(stage: TownStageIndex): void {
    const data = TOWN_ISO_STAGES[stage];
    if (!data) return;
    for (const row of data.scenery) {
      const [key, wx, wy, tint] = row;
      const flags = row[4] ?? {};
      const frame = TOWN_ISO_SPRITES[key];
      if (!frame) continue;
      const [ax, ay, w, h] = frame;
      const s = isoWorldToScreen(wx, wy);
      const flip = flags.flip === true;
      this.track(
        this.scene.add
          .image(s.x, s.y, TOWN_ISO_ATLAS.dim, key)
          .setOrigin(flip ? 1 - ax / w : ax / w, ay / h)
          .setScale(TOWN_ISO_SCALE * (flags.scale ?? 1))
          .setFlipX(flip)
          .setTint(tint)
          .setDepth(isoDepthForWorldY(wy)),
      );
    }
  }

  private buildLights(stage: TownStageIndex): void {
    const data = TOWN_ISO_STAGES[stage];
    if (!data) return;
    for (const [wx, wy, color, rad, k] of data.lights) {
      const s = isoWorldToScreen(wx, wy);
      this.track(
        this.scene.add
          .image(s.x, s.y, TOWN_ISO_TEXTURE.light)
          .setDisplaySize(rad * 2 * TOWN_ISO_SCALE, rad * 1.1 * TOWN_ISO_SCALE)
          .setTint(LIGHT_RGB[color])
          .setAlpha(Math.min(1, k * LIGHT_ALPHA))
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(TOWN_ISO_DEPTH.light),
      );
    }
  }

  private addSmokeSource(wx: number, wy: number): void {
    for (let i = 0; i < SMOKE_PUFFS; i++) {
      const img = this.track(
        this.scene.add
          .image(0, 0, TOWN_ISO_TEXTURE.smoke)
          .setDepth(TOWN_ISO_DEPTH.smoke),
      );
      const p: SmokePuff = {
        img,
        x: wx,
        y: wy,
        age: (i / SMOKE_PUFFS) * SMOKE_LIFE_MS,
        seed: wx * 0.013 + i,
      };
      this.placePuff(p);
      this.puffs.push(p);
    }
  }

  private placePuff(p: SmokePuff): void {
    const t = p.age / SMOKE_LIFE_MS;
    const r = 9 + 22 * t;
    const wx = p.x + Math.sin(t * 3 + p.seed) * 14 + 22 * t;
    const wy = p.y - SMOKE_RISE * t;
    const s = isoWorldToScreen(wx, wy);
    const fadeIn = Math.min(1, t * 6);
    p.img
      .setPosition(s.x, s.y)
      .setDisplaySize(r * 2.4 * TOWN_ISO_SCALE, r * 2 * TOWN_ISO_SCALE)
      .setAlpha(0.42 * fadeIn * (1 - t));
  }
}
