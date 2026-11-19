import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import type { SpellDefinition } from "../content/spells";
import { spellCastMs, spellTargetMode } from "../content/spellTargeting";

export type SpellAoeTelegraphPalette = {
  fill: number;
  stroke: number;
  inner: number;
};

export type SpellGroundAoeTelegraph = {
  gfx: Phaser.GameObjects.Graphics;
  zoneX: number;
  zoneY: number;
  zoneRadius: number;
  phaseMs: number;
  palette: SpellAoeTelegraphPalette;
  mode: "windup" | "channel" | "impact";
  windupMs: number;
};

const PALETTE_ICE: SpellAoeTelegraphPalette = {
  fill: 0x7dd3fc,
  stroke: 0x38bdf8,
  inner: 0xe0f2fe,
};
const PALETTE_FIRE: SpellAoeTelegraphPalette = {
  fill: 0xff5533,
  stroke: 0xffcc66,
  inner: 0xffffff,
};
const PALETTE_DEFAULT: SpellAoeTelegraphPalette = {
  fill: 0x94a3b8,
  stroke: 0xe2e8f0,
  inner: 0xf8fafc,
};

export function spellGroundAoePalette(def: SpellDefinition): SpellAoeTelegraphPalette {
  if (def.id === "blizzard") return PALETTE_ICE;
  if (def.damageFlavor === "fire" || def.id === "meteor" || def.id === "flamestrike") {
    return PALETTE_FIRE;
  }
  return PALETTE_DEFAULT;
}

/** Ground-target spells that show a blast-radius telegraph during cast. */
export function spellNeedsGroundAoeTelegraph(def: SpellDefinition): boolean {
  if (spellTargetMode(def) !== "ground") return false;
  if ((def.blastRadius ?? 0) <= 0) return false;
  const windup = spellCastMs(def);
  const channel = def.channelMs ?? 0;
  return windup > 0 || channel > 0;
}

export function spawnSpellGroundAoeTelegraph(
  scene: Phaser.Scene,
  zoneX: number,
  zoneY: number,
  zoneRadius: number,
  palette: SpellAoeTelegraphPalette,
  windupMs: number,
  mode: "windup" | "channel" | "impact" = "windup",
): SpellGroundAoeTelegraph {
  const gfx = scene.add.graphics();
  gfx.setDepth(DEFENSE_RENDER_DEPTH.spellGroundTelegraph);
  return {
    gfx,
    zoneX,
    zoneY,
    zoneRadius,
    phaseMs: 0,
    palette,
    mode,
    windupMs: Math.max(1, windupMs),
  };
}

export function updateSpellGroundAoeTelegraph(
  telegraph: SpellGroundAoeTelegraph,
  deltaMs: number,
  mode: "windup" | "channel" | "impact",
  windupProgress: number,
): void {
  telegraph.mode = mode;
  telegraph.phaseMs += deltaMs;
  const r = telegraph.zoneRadius;
  const pal = telegraph.palette;
  const pulse = 0.35 + 0.25 * Math.sin(telegraph.phaseMs * 0.012);
  const active = mode === "channel" || mode === "impact";
  const t =
    mode === "windup"
      ? Math.min(1, Math.max(0, windupProgress))
      : mode === "impact"
        ? 1
        : 1;
  const fillAlpha = active ? 0.2 + pulse * 0.14 : 0.1 + t * 0.18;
  const strokeAlpha = active ? 0.88 : 0.42 + t * 0.38;

  telegraph.gfx.clear();
  telegraph.gfx.lineStyle(3, pal.stroke, strokeAlpha);
  telegraph.gfx.fillStyle(pal.fill, fillAlpha);
  telegraph.gfx.strokeCircle(telegraph.zoneX, telegraph.zoneY, r);
  telegraph.gfx.fillCircle(telegraph.zoneX, telegraph.zoneY, r);

  const inner = r * (active ? 0.55 + pulse * 0.15 : 0.35 + t * 0.45);
  telegraph.gfx.lineStyle(2, pal.inner, active ? 0.35 + pulse * 0.25 : 0.2 + t * 0.3);
  telegraph.gfx.strokeCircle(telegraph.zoneX, telegraph.zoneY, inner);
}

export function destroySpellGroundAoeTelegraph(
  telegraph: SpellGroundAoeTelegraph | null | undefined,
): void {
  telegraph?.gfx.destroy();
}

/** Defense dual-camera rig: world-space graphics must live under the world layer. */
export function registerSpellGroundAoeTelegraphWorld(
  telegraph: SpellGroundAoeTelegraph,
  registerWorld?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  registerWorld?.(telegraph.gfx);
}