import Phaser from "phaser";
import { PLAYER_TUNING } from "../config";
import type { SpellDefinition } from "../content/spells";
import {
  applyDamage,
  swingSpellDamageFlavor,
  type Damageable,
  type DamageFlavor,
} from "./DamageSystem";
import { applyEnemyKnockbackFrom } from "./enemyKnockback";
import {
  spellBlastKnockback,
  spellChainHopKnockback,
  spellChainKnockback,
  spellDirectKnockback,
} from "./spellKnockback";
import {
  enemiesInCone,
  enemiesInDisk,
  enemiesInSwingArc,
  nearestEnemy,
  pickChainLightningTargets,
  type EnemyHitTarget,
} from "./spellMechanics";
import { applySpellOnHitEffects } from "./spellOnHitEffects";
import type { EnemySpellStatusMap } from "./enemySpellStatus";
import {
  spawnPlayerProjectile,
  type PlayerProjectile,
  type SpellProjectileBehavior,
} from "../entities/Projectile";
import { worldUnit } from "../core/worldPixelScale";
import { showPlayerMeleeSwipe } from "./MeleeSwipeFx";
import { showSpellConeFx } from "./SpellConeFx";
import { showChainLightningFx } from "./ChainLightningFx";
import { ICE_BOLT_SPELL_ID } from "../content/iceFxSpells";
import { attachIceBoltProjectileFx } from "./SpellIceBoltProjectileFx";
import { attachPvfxProjectileFx } from "./SpellPvfxProjectileFx";
import { PVFX_TEXTURE, spellProjectileTextureKey } from "../content/combatPvfxAssets";

export function applyNova(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  def: SpellDefinition,
  enemies: Array<{
    id: string;
    x: number;
    y: number;
    radius: number;
    damageable: Damageable;
  }>,
  damageMult: number,
  status?: EnemySpellStatusMap,
): void {
  if (def.blastRadiusWu === undefined) {
    throw new Error(`Spell ${def.id} missing blastRadiusWu`);
  }
  const radius = worldUnit(def.blastRadiusWu, scene.registry);
  const damage = (def.baseDamage ?? 20) * damageMult;
  for (const e of enemies) {
    if (!e.damageable.alive) continue;
    const d = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y);
    if (d <= radius + e.radius) {
      applyDamage(e.damageable, damage, def.damageFlavor ?? "fire");
      if (status && def.onHit) {
        applySpellOnHitEffects(status, e.id, def.onHit, def.damageFlavor ?? "fire");
      }
    }
  }
}

export type SpellEnemyTarget = EnemyHitTarget & {
  damageable: Damageable;
  sprite: Phaser.Physics.Arcade.Sprite;
  enemy: import("../entities/Enemy").EnemyInstance;
};

export function spawnSpellProjectile(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  angleRad: number,
  def: SpellDefinition,
  damageMult: number,
  id: string,
  opts?: {
    behavior?: SpellProjectileBehavior;
    trackEnemyId?: string | null;
    pierce?: boolean;
  },
): PlayerProjectile {
  const fallbackKey = def.projectileTextureKey;
  if (!fallbackKey) {
    throw new Error(`spell ${def.id} has no MobileRPG projectileTextureKey`);
  }
  const textureKey = spellProjectileTextureKey(scene, def.id, fallbackKey);
  const speedWu =
    def.projectileSpeedWu ?? PLAYER_TUNING.projectileSpeedWu * 1.05;
  const speed = worldUnit(speedWu, scene.registry);
  const damage = (def.baseDamage ?? 20) * damageMult;
  const flavor: DamageFlavor = def.damageFlavor ?? "fire";
  const projectile = spawnPlayerProjectile(
    scene,
    playerX,
    playerY,
    angleRad,
    speed,
    damage,
    worldUnit(PLAYER_TUNING.rangedMaxRangeWu, scene.registry),
    id,
    textureKey,
    flavor,
  );
  const behavior =
    opts?.behavior ??
    (def.mechanicType === "projectile_aoe"
      ? "aoe_on_hit"
      : def.id === "water_bolt"
        ? "pierce"
        : def.mechanicType === "tracking_projectile"
          ? "tracking"
          : "default");
  projectile.spellBehavior = behavior;
  if (behavior === "aoe_on_hit") {
    if (def.blastRadiusWu === undefined) {
      throw new Error(`Spell ${def.id} missing blastRadiusWu`);
    }
    projectile.blastRadiusWu = worldUnit(def.blastRadiusWu, scene.registry);
  }
  if (behavior === "tracking") {
    projectile.trackEnemyId = opts?.trackEnemyId ?? null;
  }
  if (behavior === "pierce" || opts?.pierce) {
    projectile.spellBehavior = "pierce";
  }
  projectile.spellId = def.id;
  if (def.id === ICE_BOLT_SPELL_ID) {
    attachIceBoltProjectileFx(scene, projectile);
  } else if (
    textureKey === PVFX_TEXTURE.fireballFlight ||
    textureKey === PVFX_TEXTURE.lightningFlight
  ) {
    attachPvfxProjectileFx(scene, projectile, textureKey);
  }
  return projectile;
}

export function applySpellBlastAt(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  def: SpellDefinition,
  enemies: SpellEnemyTarget[],
  damageMult: number,
  status?: EnemySpellStatusMap,
  knockbackExcludeIds?: ReadonlySet<string>,
): void {
  if (def.blastRadiusWu === undefined) {
    throw new Error(`Spell ${def.id} missing blastRadiusWu`);
  }
  const r = worldUnit(def.blastRadiusWu, scene.registry);
  const damage = (def.baseDamage ?? 0) * damageMult;
  const flavor = def.damageFlavor ?? "fire";
  const knockbackPx = worldUnit(spellBlastKnockback(def), scene.registry);
  for (const e of enemiesInDisk(centerX, centerY, r, enemies)) {
    const full = enemies.find((x) => x.id === e.id);
    if (!full?.damageable.alive) continue;
    applyDamage(full.damageable, damage, flavor);
    if (knockbackPx > 0 && !knockbackExcludeIds?.has(full.id)) {
      applyEnemyKnockbackFrom(full.enemy, centerX, centerY, knockbackPx);
    }
    if (status && def.onHit) {
      applySpellOnHitEffects(status, full.id, def.onHit, flavor);
    }
  }
}

export function applySpellSwing(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  facingRad: number,
  def: SpellDefinition,
  enemies: SpellEnemyTarget[],
  damageMult: number,
  status?: EnemySpellStatusMap,
): void {
  const range = worldUnit(def.swingRangeWu!, scene.registry);
  const damage = (def.baseDamage ?? 16) * damageMult;
  const flavor = swingSpellDamageFlavor(def.damageFlavor);
  showPlayerMeleeSwipe(scene, playerX, playerY, facingRad, 160);
  for (const e of enemiesInSwingArc(
    playerX,
    playerY,
    facingRad,
    range,
    def.swingArcDeg!,
    enemies,
  )) {
    const full = enemies.find((x) => x.id === e.id);
    if (!full?.damageable.alive) continue;
    applyDamage(full.damageable, damage, flavor);
    applyEnemyKnockbackFrom(
      full.enemy,
      playerX,
      playerY,
      worldUnit(spellDirectKnockback(def), scene.registry),
    );
    if (status && def.onHit) {
      applySpellOnHitEffects(status, full.id, def.onHit, flavor);
    }
  }
}

export function strikeSpellCone(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  facingRad: number,
  def: SpellDefinition,
  enemies: SpellEnemyTarget[],
  damageMult: number,
  status?: EnemySpellStatusMap,
): void {
  const range = worldUnit(def.coneRangeWu!, scene.registry);
  const half = Phaser.Math.DegToRad(def.coneArcDeg! / 2);
  const damage = (def.baseDamage ?? 12) * damageMult;
  const flavor = def.damageFlavor ?? "fire";
  for (const e of enemiesInCone(playerX, playerY, facingRad, range, half, enemies)) {
    const full = enemies.find((x) => x.id === e.id);
    if (!full?.damageable.alive) continue;
    applyDamage(full.damageable, damage, flavor);
    applyEnemyKnockbackFrom(
      full.enemy,
      playerX,
      playerY,
      worldUnit(spellDirectKnockback(def), scene.registry),
    );
    if (status && def.onHit) {
      applySpellOnHitEffects(status, full.id, def.onHit, flavor);
    }
  }
}

export function applySpellCone(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  facingRad: number,
  def: SpellDefinition,
  enemies: SpellEnemyTarget[],
  damageMult: number,
  status?: EnemySpellStatusMap,
  opts?: { showFx?: boolean },
): void {
  if (opts?.showFx !== false) {
    showSpellConeFx(
      scene,
      playerX,
      playerY,
      facingRad,
      def.coneRangeWu!,
      def.coneArcDeg!,
    );
  }
  strikeSpellCone(scene, playerX, playerY, facingRad, def, enemies, damageMult, status);
}

export function applyInstantTargeted(
  scene: Phaser.Scene,
  def: SpellDefinition,
  enemies: SpellEnemyTarget[],
  targetId: string | null,
  playerX: number,
  playerY: number,
  damageMult: number,
  status?: EnemySpellStatusMap,
): string | null {
  const maxR = worldUnit(
    def.groundTargetMaxRangeWu ?? PLAYER_TUNING.autoAttackRangedRange,
    scene.registry,
  );
  const target =
    (targetId && enemies.find((e) => e.id === targetId && e.damageable.alive)) ||
    nearestEnemy(playerX, playerY, enemies, maxR);
  if (!target) return null;
  const full = enemies.find((e) => e.id === target.id);
  if (!full) return null;
  const flavor = def.damageFlavor ?? "fire";
  const hitDamage = (def.baseDamage ?? 0) * damageMult;
  const blastKnockbackExclude = new Set<string>([full.id]);
  if (hitDamage > 0) {
    applyDamage(full.damageable, hitDamage, flavor);
    applyEnemyKnockbackFrom(
      full.enemy,
      playerX,
      playerY,
      worldUnit(spellDirectKnockback(def), scene.registry),
    );
  } else {
    blastKnockbackExclude.delete(full.id);
  }
  if (def.burstDamage && def.burstDamage > 0) {
    applyDamage(full.damageable, def.burstDamage * damageMult, flavor);
    if (def.blastRadiusWu) {
      applySpellBlastAt(
        scene,
        full.x,
        full.y,
        { ...def, baseDamage: def.burstDamage * 0.65 },
        enemies,
        damageMult,
        status,
        blastKnockbackExclude,
      );
    }
  } else if (def.blastRadiusWu) {
    applySpellBlastAt(
      scene,
      full.x,
      full.y,
      { ...def, baseDamage: (def.baseDamage ?? 16) * 0.65 },
      enemies,
      damageMult,
      status,
      blastKnockbackExclude,
    );
  }
  if (status && def.onHit) {
    applySpellOnHitEffects(status, full.id, def.onHit, flavor);
  }
  return full.id;
}

export function applyChainLightning(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  def: SpellDefinition,
  enemies: SpellEnemyTarget[],
  damageMult: number,
  startEnemyId?: string | null,
  status?: EnemySpellStatusMap,
): void {
  const hopRange = worldUnit(def.chainLightningHopRangeWu!, scene.registry);
  const living = enemies.filter((e) => e.damageable.alive);
  const start =
    (startEnemyId && living.find((e) => e.id === startEnemyId)) ||
    nearestEnemy(playerX, playerY, living);
  if (!start) return;
  const chain = pickChainLightningTargets(
    start.x,
    start.y,
    living,
    def.chainLightningHops!,
    hopRange,
  );
  const damage = (def.baseDamage ?? 10) * damageMult;
  const flavor = def.damageFlavor ?? "fire";
  const applyHopHit = (enemyId: string) => {
    if (status && def.onHit) {
      applySpellOnHitEffects(status, enemyId, def.onHit, flavor);
    }
  };
  const startFull = living.find((e) => e.id === start.id)!;
  applyDamage(startFull.damageable, damage, flavor);
  applyEnemyKnockbackFrom(
    startFull.enemy,
    playerX,
    playerY,
    worldUnit(spellChainKnockback(def), scene.registry),
  );
  applyHopHit(start.id);
  let fromX = start.x;
  let fromY = start.y;
  for (const hop of chain) {
    const full = living.find((e) => e.id === hop.id);
    if (!full) continue;
    applyDamage(full.damageable, damage, flavor);
    applyEnemyKnockbackFrom(
      full.enemy,
      fromX,
      fromY,
      worldUnit(spellChainHopKnockback(def), scene.registry),
    );
    applyHopHit(full.id);
    fromX = hop.x;
    fromY = hop.y;
  }
  if (chain.length > 0) {
    showChainLightningFx(
      scene,
      { x: start.x, y: start.y },
      chain.map((h) => ({ x: h.x, y: h.y })),
    );
  }
}

/** @deprecated use spawnSpellProjectile */
export function spawnChanneledFireball(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  angleRad: number,
  def: SpellDefinition,
  damageMult: number,
  id: string,
): PlayerProjectile {
  return spawnSpellProjectile(
    scene,
    playerX,
    playerY,
    angleRad,
    def,
    damageMult,
    id,
  );
}

export function applyHealAmount(damageable: Damageable, amount: number): void {
  if (amount <= 0) return;
  damageable.hp = Math.min(damageable.maxHp, damageable.hp + amount);
  damageable.alive = damageable.hp > 0;
}

export function applyChanneledHeal(
  damageable: Damageable,
  def: SpellDefinition,
): void {
  applyHealAmount(damageable, def.healAmount ?? 20);
}