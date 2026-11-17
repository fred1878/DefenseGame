import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { worldUnit } from "../core/worldPixelScale";
import {
  SPELL_CONE_ARC_DEG,
  SPELL_CONE_RANGE_WU,
} from "./spellMechanics";

const SPELL_CONE_FX_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

const CONE_FILL = 0xff6622;
const CONE_EDGE = 0xff4422;

const CONE_FX_HOLD_MS = 320;

export function showSpellConeFx(
  scene: Phaser.Scene,
  originX: number,
  originY: number,
  facingRad: number,
): void {
  const range = worldUnit(SPELL_CONE_RANGE_WU, scene.registry);
  const half = Phaser.Math.DegToRad(SPELL_CONE_ARC_DEG / 2);
  const start = facingRad - half;
  const end = facingRad + half;

  const gfx = scene.add.graphics();
  gfx.setDepth(SPELL_CONE_FX_DEPTH);
  gfx.fillStyle(CONE_FILL, 0.55);
  gfx.beginPath();
  gfx.moveTo(originX, originY);
  gfx.arc(originX, originY, range, start, end, false);
  gfx.closePath();
  gfx.fillPath();
  gfx.lineStyle(2, CONE_EDGE, 0.75);
  gfx.beginPath();
  gfx.moveTo(originX, originY);
  gfx.arc(originX, originY, range, start, end, false);
  gfx.closePath();
  gfx.strokePath();

  const fadeMs = Math.max(120, CONE_FX_HOLD_MS - 60);
  scene.tweens.add({
    targets: gfx,
    alpha: 0,
    duration: fadeMs,
    delay: 50,
    ease: "Quad.easeOut",
    onComplete: () => gfx.destroy(),
  });
}