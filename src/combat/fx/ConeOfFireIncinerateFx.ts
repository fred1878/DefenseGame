import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import {
  assertPvfxClipReady,
  PVFX_ANIM,
  PVFX_TEXTURE,
} from "../../content/combatPvfxAssets";
import { worldUnit } from "../../config/worldScale";

const DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

/** PVFX `fire/incinerate` lit — pivot in 64×64 source space. */
export const INCINERATE_SOURCE_SIZE = 64;
export const INCINERATE_ORIGIN_X = 22 / INCINERATE_SOURCE_SIZE;
export const INCINERATE_ORIGIN_Y = 60 / INCINERATE_SOURCE_SIZE;

/** Fan offset from center aim (25° each side). */
export const CONE_OF_FIRE_FAN_STEP_RAD = Phaser.Math.DegToRad(25);

/**
 * Incinerate art travels toward the top of the sheet (+local Y = screen up at rotation 0).
 * Map world aim (from `atan2`) to sprite rotation without flipX.
 */
export const PVFX_INCINERATE_UP_ROT_OFFSET = Math.PI / 2;

export function incinerateRotationRad(facingRad: number): number {
  return facingRad + PVFX_INCINERATE_UP_ROT_OFFSET;
}

export function coneOfFireFanAngles(
  facingRad: number,
): [number, number, number] {
  const step = CONE_OF_FIRE_FAN_STEP_RAD;
  return [facingRad - step, facingRad, facingRad + step];
}

/** Three fanning `fire/incinerate` PVFX at the caster on the first cone tick. */
export function playConeOfFireIncinerateFx(
  scene: Phaser.Scene,
  originX: number,
  originY: number,
  facingRad: number,
  coneRangeWu: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertPvfxClipReady(
    scene,
    PVFX_TEXTURE.incinerate,
    PVFX_ANIM.incinerate,
    "cone_of_fire",
  );
  const rangePx = worldUnit(coneRangeWu, scene.registry);
  const display = Math.max(rangePx, INCINERATE_SOURCE_SIZE);
  for (const aim of coneOfFireFanAngles(facingRad)) {
    const sprite = scene.add
      .sprite(originX, originY, PVFX_TEXTURE.incinerate)
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.95)
      .setOrigin(INCINERATE_ORIGIN_X, INCINERATE_ORIGIN_Y)
      .setRotation(incinerateRotationRad(aim))
      .setDisplaySize(display, display)
      .play(PVFX_ANIM.incinerate);
    registerWorldDraw?.(sprite);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
      sprite.destroy(),
    );
  }
}
