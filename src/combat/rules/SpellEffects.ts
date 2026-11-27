import { playerTuning } from "../../config/player";
import Phaser from "phaser";
import { requireSpellNumber, type SpellDefinition } from "../../content/spells";
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
} from "../../entities/Projectile";
import { worldUnit } from "../../config/worldScale";
import { showPlayerMeleeSwipe } from "../fx/MeleeSwipeFx";
import { playConeOfFireIncinerateFx } from "../fx/ConeOfFireIncinerateFx";
import { showSpellConeFx } from "../fx/SpellConeFx";
import { showChainLightningFx } from "../fx/ChainLightningFx";
import { ICE_BOLT_SPELL_ID } from "../../content/iceFxSpells";
import {
  ICE_FX_TEXTURE,
  assertIceCombatFxReady,
} from "../../content/iceFxAssets";
import {
  attachIceBoltProjectileFx,
  playIceBoltHitFx,
} from "../fx/SpellIceBoltProjectileFx";
import { attachPvfxProjectileFx } from "../fx/SpellPvfxProjectileFx";
import {
  PVFX_TEXTURE,
  spellProjectileTextureKey,
} from "../../content/combatPvfxAssets";

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
  const damage = requireSpellNumber(def, "baseDamage") * damageMult;
  for (const e of enemies) {
    if (!e.damageable.alive) continue;
    const d = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y);
    if (d <= radius + e.radius) {
      applyDamage(e.damageable, damage, def.damageFlavor ?? "fire", def.id);
      if (status && def.onHit) {
        applySpellOnHitEffects(
          status,
          e.id,
          def.onHit,
          def.damageFlavor ?? "fire",
          def.id,
        );
      }
    }
  }
}

export type SpellEnemyTarget = EnemyHitTarget & {
  damageable: Damageable;
  sprite: Phaser.Physics.Arcade.Sprite;
  enemy: import("../../entities/Enemy").EnemyInstance;
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
  if (def.id === ICE_BOLT_SPELL_ID) {
    assertIceCombatFxReady(scene, "ice_bolt spawn");
  }
  const textureKey =
    def.id === ICE_BOLT_SPELL_ID
      ? ICE_FX_TEXTURE.boltRepeat
      : spellProjectileTextureKey(scene, def.id, fallbackKey);
  const speedWu =
    def.projectileSpeedWu ?? playerTuning().projectileSpeedWu * 1.05;
  const speed = worldUnit(speedWu, scene.registry);
  const damage = requireSpellNumber(def, "baseDamage") * damageMult;
  const flavor: DamageFlavor = def.damageFlavor ?? "fire";
  const projectile = spawnPlayerProjectile(
    scene,
    playerX,
    playerY,
    angleRad,
    speed,
    damage,
    worldUnit(playerTuning().rangedMaxRangeWu, scene.registry),
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
    projectile.sprite.setAlpha(0);
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
    applyDamage(full.damageable, damage, flavor, def.id);
    if (knockbackPx > 0 && !knockbackExcludeIds?.has(full.id)) {
      applyEnemyKnockbackFrom(full.enemy, centerX, centerY, knockbackPx);
    }
    if (status && def.onHit) {
      applySpellOnHitEffects(status, full.id, def.onHit, flavor, def.id);
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
  const damage = requireSpellNumber(def, "baseDamage") * damageMult;
  const flavor = swingSpellDamageFlavor(def.damageFlavor);
  const fxSize = requireSpellNumber(def, "swingFxSizePx");
  showPlayerMeleeSwipe(scene, playerX, playerY, facingRad, fxSize, fxSize);
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
    applyDamage(full.damageable, damage, flavor, def.id);
    applyEnemyKnockbackFrom(
      full.enemy,
      playerX,
      playerY,
      worldUnit(spellDirectKnockback(def), scene.registry),
    );
    if (status && def.onHit) {
      applySpellOnHitEffects(status, full.id, def.onHit, flavor, def.id);
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
  const damage = requireSpellNumber(def, "baseDamage") * damageMult;
  const flavor = def.damageFlavor ?? "fire";
  for (const e of enemiesInCone(
    playerX,
    playerY,
    facingRad,
    range,
    half,
    enemies,
  )) {
    const full = enemies.find((x) => x.id === e.id);
    if (!full?.damageable.alive) continue;
    applyDamage(full.damageable, damage, flavor, def.id);
    applyEnemyKnockbackFrom(
      full.enemy,
      playerX,
      playerY,
      worldUnit(spellDirectKnockback(def), scene.registry),
    );
    if (status && def.onHit) {
      applySpellOnHitEffects(status, full.id, def.onHit, flavor, def.id);
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
  opts?: {
    showFx?: boolean;
    registerWorldDraw?:
      | ((go: Phaser.GameObjects.GameObject) => void)
      | undefined;
  },
): void {
  if (opts?.showFx !== false) {
    if (def.id === "cone_of_fire") {
      playConeOfFireIncinerateFx(
        scene,
        playerX,
        playerY,
        facingRad,
        def.coneRangeWu!,
        opts?.registerWorldDraw,
      );
    } else {
      showSpellConeFx(
        scene,
        playerX,
        playerY,
        facingRad,
        def.coneRangeWu!,
        def.coneArcDeg!,
      );
    }
    if (def.id === "cone_of_cold") {
      playIceBoltHitFx(
        scene,
        playerX,
        playerY,
        facingRad,
        opts?.registerWorldDraw,
      );
    }
  }
  strikeSpellCone(
    scene,
    playerX,
    playerY,
    facingRad,
    def,
    enemies,
    damageMult,
    status,
  );
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
    def.groundTargetMaxRangeWu ?? playerTuning().autoAttackRangedRange,
    scene.registry,
  );
  const living = enemies.filter((e) => e.damageable.alive);
  const target =
    (targetId && living.find((e) => e.id === targetId)) ||
    nearestEnemy(playerX, playerY, living, maxR);
  if (!target) return null;
  const full = enemies.find((e) => e.id === target.id);
  if (!full) return null;
  const flavor = def.damageFlavor ?? "fire";
  const hitDamage = (def.baseDamage ?? 0) * damageMult;
  const blastKnockbackExclude = new Set<string>([full.id]);
  if (hitDamage > 0) {
    applyDamage(full.damageable, hitDamage, flavor, def.id);
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
    applyDamage(full.damageable, def.burstDamage * damageMult, flavor, def.id);
    if (def.blastRadiusWu) {
      applySpellBlastAt(
        scene,
        full.x,
        full.y,
        {
          ...def,
          baseDamage:
            def.burstDamage * requireSpellNumber(def, "burstBlastDamageScale"),
        },
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
      {
        ...def,
        baseDamage:
          requireSpellNumber(def, "baseDamage") *
          requireSpellNumber(def, "burstBlastDamageScale"),
      },
      enemies,
      damageMult,
      status,
      blastKnockbackExclude,
    );
  }
  if (status && def.onHit) {
    applySpellOnHitEffects(status, full.id, def.onHit, flavor, def.id);
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
  // The start enemy is struck directly below; hops jump to other enemies only.
  const chain = pickChainLightningTargets(
    start.x,
    start.y,
    living.filter((e) => e.id !== start.id),
    def.chainLightningHops!,
    hopRange,
  );
  const damage = requireSpellNumber(def, "baseDamage") * damageMult;
  const flavor = def.damageFlavor ?? "fire";
  const applyHopHit = (enemyId: string) => {
    if (status && def.onHit) {
      applySpellOnHitEffects(status, enemyId, def.onHit, flavor, def.id);
    }
  };
  const startFull = living.find((e) => e.id === start.id)!;
  applyDamage(startFull.damageable, damage, flavor, def.id);
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
    applyDamage(full.damageable, damage, flavor, def.id);
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
  const before = damageable.hp;
  damageable.hp = Math.min(damageable.maxHp, damageable.hp + amount);
  damageable.alive = damageable.hp > 0;
  const applied = damageable.hp - before;
  if (applied > 0) damageable.onHealed?.(applied);
}

export function applyChanneledHeal(
  damageable: Damageable,
  def: SpellDefinition,
): void {
  applyHealAmount(damageable, requireSpellNumber(def, "healAmount"));
}
