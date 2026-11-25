import type Phaser from "phaser";
import type { SpellDefinition } from "../content/spells";
import { spellChannelTickMs } from "../content/spellTargeting";
import {
  applyDamage,
  type Damageable,
  type DamageFlavor,
} from "./DamageSystem";
import { enemiesInDisk, type EnemyHitTarget } from "./spellMechanics";
import type { EnemySpellStatusMap } from "./enemySpellStatus";
import { applySpellOnHitEffects } from "./spellOnHitEffects";
import { worldUnit } from "../core/worldPixelScale";
import {
  channeledGroundZoneCompletionRemainder,
  channeledGroundZoneMaxTicks,
  channeledGroundZonePerTickDamage,
} from "./channeledGroundZoneChannel";

export type SpellGroundZone = {
  id: string;
  spellId: string;
  x: number;
  y: number;
  radiusWu: number;
  expiresAt: number;
  tickAccumMs: number;
  tickEveryMs: number;
  tickDamage: number;
  /** Ticks that dealt channel damage (channeled zones only). */
  channelTicksDone?: number;
  channelMaxTicks?: number;
  channelDamageRemainder?: number;
  burstDamage?: number;
  damageFlavor: DamageFlavor;
  onHit?: SpellDefinition["onHit"];
  /** After channel burst, dot ticks use linger def. */
  lingerDotDps?: number;
  lingerDotMs?: number;
  didBurst?: boolean;
};

export function spawnGroundZone(
  scene: Phaser.Scene,
  def: SpellDefinition,
  centerX: number,
  centerY: number,
  damageMult: number,
  now: number,
  opts?: {
    durationMs: number;
    includeBurst?: boolean;
    lingerDot?: boolean;
  },
): SpellGroundZone {
  if (def.blastRadiusWu === undefined) {
    throw new Error(`spawnGroundZone requires blastRadiusWu for ${def.id}`);
  }
  const r = worldUnit(def.blastRadiusWu, scene.registry);
  const lingerDot = opts?.lingerDot ?? false;
  const tickDamage = lingerDot
    ? 0
    : channeledGroundZonePerTickDamage(def, damageMult);
  const channelMaxTicks = lingerDot
    ? undefined
    : channeledGroundZoneMaxTicks(def);
  const channelDamageRemainder = lingerDot
    ? undefined
    : channeledGroundZoneCompletionRemainder(def, damageMult);
  return {
    id: `zone_${def.id}_${now}`,
    spellId: def.id,
    x: centerX,
    y: centerY,
    radiusWu: r,
    expiresAt: now + (opts?.durationMs ?? def.channelMs ?? 2500),
    tickAccumMs: 0,
    tickEveryMs: lingerDot
      ? (def.lingerTickMs ?? 250)
      : spellChannelTickMs(def),
    tickDamage,
    channelTicksDone: lingerDot ? undefined : 0,
    channelMaxTicks,
    channelDamageRemainder,
    burstDamage:
      opts?.includeBurst && def.burstDamage
        ? def.burstDamage * damageMult
        : undefined,
    damageFlavor: def.damageFlavor ?? "fire",
    onHit: def.onHit,
    lingerDotDps: lingerDot ? def.onHit?.dotDps : undefined,
    lingerDotMs: lingerDot ? def.onHit?.dotMs : undefined,
    didBurst: false,
  };
}

export function tickSpellGroundZones(
  _scene: Phaser.Scene,
  zones: SpellGroundZone[],
  now: number,
  deltaMs: number,
  enemies: Array<EnemyHitTarget & { damageable: Damageable; id: string }>,
  status: EnemySpellStatusMap,
  damageMult: number,
): SpellGroundZone[] {
  return zones.filter((z) => {
    z.tickAccumMs += deltaMs;
    const inZone = enemiesInDisk(z.x, z.y, z.radiusWu, enemies);
    if (z.burstDamage && !z.didBurst) {
      z.didBurst = true;
      for (const e of inZone) {
        const full = enemies.find((x) => x.id === e.id);
        if (!full?.damageable.alive) continue;
        applyDamage(full.damageable, z.burstDamage, z.damageFlavor);
        if (z.onHit)
          applySpellOnHitEffects(status, full.id, z.onHit, z.damageFlavor);
      }
    }
    while (z.tickAccumMs >= z.tickEveryMs) {
      z.tickAccumMs -= z.tickEveryMs;
      let tickDmg =
        z.lingerDotDps && z.lingerDotDps > 0
          ? z.lingerDotDps * damageMult * (z.tickEveryMs / 1000)
          : z.tickDamage;
      if (
        !z.lingerDotDps &&
        z.channelMaxTicks !== undefined &&
        z.channelDamageRemainder !== undefined &&
        z.channelDamageRemainder > 0
      ) {
        const nextTick = (z.channelTicksDone ?? 0) + 1;
        if (nextTick >= z.channelMaxTicks) {
          tickDmg += z.channelDamageRemainder;
        }
      }
      if (!z.lingerDotDps) {
        z.channelTicksDone = (z.channelTicksDone ?? 0) + 1;
      }
      if (tickDmg <= 0) continue;
      for (const e of inZone) {
        const full = enemies.find((x) => x.id === e.id);
        if (!full?.damageable.alive) continue;
        applyDamage(full.damageable, tickDmg, z.damageFlavor);
        if (z.onHit && !z.lingerDotDps) {
          applySpellOnHitEffects(status, full.id, z.onHit, z.damageFlavor);
        }
      }
    }
    return now < z.expiresAt;
  });
}
