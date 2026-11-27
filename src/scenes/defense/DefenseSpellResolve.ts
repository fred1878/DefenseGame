import type Phaser from "phaser";
import type { SpellDefinition, SpellMechanicType } from "../../content/spells";
import {
  applyChanneledHeal,
  applyHealAmount,
  applyChainLightning,
  applyInstantTargeted,
  applySpellBlastAt,
  applySpellCone,
  applySpellSwing,
  type SpellEnemyTarget,
  spawnSpellProjectile,
} from "../../combat/rules/SpellEffects";
import {
  channeledHealCompletionRemainder,
  isChanneledHealSpell,
} from "../../combat/rules/channeledHealChannel";
import { showFireNovaRingFx } from "../../combat/fx/FireNovaRingFx";
import { playFlamestrikeFirePillarBurst } from "../../combat/fx/FlamestrikePvfx";
import { resolveBlinkLanding } from "../../combat/rules/spellMechanics";
import { showFlashHealPulseFx } from "../../combat/fx/SpellFlashHealFx";
import { playIceWallSegmentEndFx } from "../../combat/fx/IceWallEndFx";
import {
  meteorStrikeFxFlipX,
  playMeteorStrikeFx,
} from "../../combat/fx/SpellMeteorStrikeFx";
import { playShadowformCastFx } from "../../combat/fx/ShadowformCastFx";
import {
  DEFENSE_RENDER_DEPTH,
  defenseHalfHeight,
  defenseHalfWidth,
} from "../../config";
import { spellTargetMode } from "../../content/spellTargeting";
import { COMBAT_FX_TEXTURE } from "../../content/assets";
import {
  correctPlayerObstacleBlockerOverlap,
  defenseObstacleBlockerAabb,
  readArcadeStaticBodyWorldAabb,
} from "../../world/defenseObstacleBlocker";
import { playerBodyRadiusPx } from "../../entities/entityPhysics";
import {
  playFireWhooshSfx,
  spellPlaysFireWhooshOnResolve,
} from "../../audio/fireWhooshSfx";
import type { DefenseSpellDirectorHost } from "./DefenseSpellDirector";

/** Per-cast values every mechanic handler reads. */
type SpellResolveFrame = {
  host: DefenseSpellDirectorHost;
  def: SpellDefinition;
  mult: number;
  px: number;
  py: number;
  angle: number;
  targets: SpellEnemyTarget[];
};

type SpellMechanicHandler = (f: SpellResolveFrame) => void;

function resolveBlast({ host, def, mult, px, py, targets }: SpellResolveFrame) {
  const remote =
    spellTargetMode(def) === "ground" && host.spellChannelArea
      ? host.spellChannelArea
      : null;
  const bx = remote?.x ?? px;
  const by = remote?.y ?? py;
  applySpellBlastAt(
    host.scene,
    bx,
    by,
    def,
    targets,
    mult,
    host.enemySpellStatus,
  );
  const blastRadiusPx = host.wu(def.blastRadiusWu!);
  if (def.id === "fire_nova") {
    showFireNovaRingFx(host.scene, bx, by, blastRadiusPx, host.maskWorldObject);
  } else if (def.id === "meteor") {
    playMeteorStrikeFx(
      host.scene,
      bx,
      by,
      blastRadiusPx,
      meteorStrikeFxFlipX(px, bx),
      host.maskWorldObject,
    );
  } else if (def.id === "flamestrike") {
    playFlamestrikeFirePillarBurst(
      host.scene,
      bx,
      by,
      blastRadiusPx,
      host.maskWorldObject,
    );
  } else {
    host.flashNova(bx, by, blastRadiusPx, {
      blastTextureKey: def.blastTextureKey,
    });
  }
}

function resolveProjectile({
  host,
  def,
  mult,
  px,
  py,
  angle,
}: SpellResolveFrame) {
  const id = `spell_proj_${host.nextProjectileId()}`;
  const projSpell = spawnSpellProjectile(
    host.scene,
    px,
    py,
    angle,
    def,
    mult,
    id,
  );
  host.maskWorldObject?.(projSpell.sprite);
  host.projectiles.push(projSpell);
}

function resolveTrackingProjectile(f: SpellResolveFrame) {
  const { host, def, mult, px, py, angle, targets } = f;
  const focus = host.targeting.focusEnemyId;
  const id = `spell_proj_${host.nextProjectileId()}`;
  const trackingProj = spawnSpellProjectile(
    host.scene,
    px,
    py,
    angle,
    def,
    mult,
    id,
    {
      behavior: "tracking",
      trackEnemyId: focus,
    },
  );
  host.maskWorldObject?.(trackingProj.sprite);
  host.projectiles.push(trackingProj);
  if (def.id === "chain_lightning") {
    applyChainLightning(
      host.scene,
      px,
      py,
      def,
      targets,
      mult,
      focus,
      host.enemySpellStatus,
    );
  }
}

function resolveSwing({ host, def, mult, px, py, targets }: SpellResolveFrame) {
  if (def.mechanicType === "tracking_swing") {
    const t = host.targeting.facingTarget("melee", true);
    if (t) host.player.faceToward(t.x, t.y);
  }
  applySpellSwing(
    host.scene,
    px,
    py,
    host.player.getFacingAngle(),
    def,
    targets,
    mult,
    host.enemySpellStatus,
  );
}

function resolveCone({
  host,
  def,
  mult,
  px,
  py,
  angle,
  targets,
}: SpellResolveFrame) {
  applySpellCone(
    host.scene,
    px,
    py,
    angle,
    def,
    targets,
    mult,
    host.enemySpellStatus,
    {
      registerWorldDraw: host.maskWorldObject,
    },
  );
}

function resolveInstantTargeted(f: SpellResolveFrame) {
  const { host, def, mult, px, py, angle, targets } = f;
  const hitId = applyInstantTargeted(
    host.scene,
    def,
    targets,
    host.targeting.focusEnemyId,
    px,
    py,
    mult,
    host.enemySpellStatus,
  );
  if (!def.projectileTextureKey) return;
  const t = hitId ? host.targeting.getEnemyById(hitId) : null;
  const tx = t?.sprite.x ?? px + Math.cos(angle) * 40;
  const ty = t?.sprite.y ?? py + Math.sin(angle) * 40;
  const aim = Math.atan2(ty - py, tx - px);
  const id = `spell_proj_${host.nextProjectileId()}`;
  const aimedProj = spawnSpellProjectile(
    host.scene,
    px,
    py,
    aim,
    def,
    mult,
    id,
  );
  host.maskWorldObject?.(aimedProj.sprite);
  host.projectiles.push(aimedProj);
}

function resolveHeal({ host, def, px, py }: SpellResolveFrame) {
  if (isChanneledHealSpell(def)) {
    const remainder = channeledHealCompletionRemainder(def);
    if (remainder > 0) {
      applyHealAmount(host.player.damageable, remainder);
    }
  } else {
    applyChanneledHeal(host.player.damageable, def);
  }
  if (def.id === "flash_heal") {
    showFlashHealPulseFx(host.scene, px, py, host.maskWorldObject);
  }
}

function resolveBuff({ host, def, px, py }: SpellResolveFrame) {
  if (def.shadowformDurationMs == null) return;
  host.shadowformEndsAt = host.timeNow() + def.shadowformDurationMs;
  if (def.id === "shadowform") {
    playShadowformCastFx(host.scene, px, py, host.maskWorldObject);
  }
}

/** Channeled mechanics resolve per tick in `DefenseSpellChannel`, not here. */
const resolveNothing: SpellMechanicHandler = () => {};

/**
 * One handler per `mechanicType`. Exhaustive: a new mechanic fails to compile
 * until it has an entry here.
 */
const SPELL_MECHANIC_HANDLERS: Record<SpellMechanicType, SpellMechanicHandler> =
  {
    blast: resolveBlast,
    projectile: resolveProjectile,
    projectile_aoe: resolveProjectile,
    tracking_projectile: resolveTrackingProjectile,
    swing: resolveSwing,
    tracking_swing: resolveSwing,
    cone: resolveCone,
    channeled_cone: resolveNothing,
    channeled: resolveNothing,
    channeled_area: resolveNothing,
    instant_targeted: resolveInstantTargeted,
    heal: resolveHeal,
    blink: (f) => castDefenseBlink(f.host, f.angle, f.def),
    buff: resolveBuff,
    ice_wall: (f) => spawnDefenseIceWall(f.host, f.angle, f.def),
  };

/** Apply a resolved spell (blast, projectiles, swing, cone, heal, blink, buff, ice wall). */
export function resolveDefenseSpellEffect(
  host: DefenseSpellDirectorHost,
  def: SpellDefinition,
  mult: number,
): void {
  if (spellPlaysFireWhooshOnResolve(def)) {
    playFireWhooshSfx(host.scene);
  }
  const angle = blinkAimRad(host, def);
  SPELL_MECHANIC_HANDLERS[def.mechanicType]?.({
    host,
    def,
    mult,
    px: host.player.sprite.x,
    py: host.player.sprite.y,
    angle,
    targets: host.enemyTargets(),
  });
  host.filterDeadEnemies();
}

/** Motion velocity when moving; otherwise caster facing (blink aim). */
export function blinkAimRad(
  host: DefenseSpellDirectorHost,
  def: SpellDefinition,
): number {
  if (def.mechanicType !== "blink") {
    return host.player.getFacingAngle();
  }
  const body = host.player.sprite.body as Phaser.Physics.Arcade.Body;
  const speed = Math.hypot(body.velocity.x, body.velocity.y);
  if (speed > 6) return Math.atan2(body.velocity.y, body.velocity.x);
  return host.player.getFacingAngle();
}

export function blinkObstacleAABBs(
  host: DefenseSpellDirectorHost,
): ReturnType<typeof defenseObstacleBlockerAabb>[] {
  const rects = host.obstacleBlockers.map((b) => defenseObstacleBlockerAabb(b));
  for (const entry of host.iceWallExpires) {
    const body = entry.sprite.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) rects.push(readArcadeStaticBodyWorldAabb(body));
  }
  return rects;
}

export function castDefenseBlink(
  host: DefenseSpellDirectorHost,
  facingRad: number,
  def: SpellDefinition,
): void {
  const reg = host.scene.registry;
  const halfW = defenseHalfWidth(reg);
  const halfH = defenseHalfHeight(reg);
  const inset = host.wu(24);
  const px = host.player.sprite.x;
  const py = host.player.sprite.y;
  const playerR = host.wu(playerBodyRadiusPx());
  const bounds = {
    minX: -halfW + inset,
    maxX: halfW - inset,
    minY: -halfH + inset,
    maxY: halfH - inset,
  };
  const enemies = host
    .enemyTargets()
    .filter((e) => e.damageable.alive)
    .map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      radius: e.radius,
    }));
  const landing = resolveBlinkLanding(
    px,
    py,
    facingRad,
    host.wu(def.blinkDistanceWu!),
    bounds,
    playerR,
    blinkObstacleAABBs(host),
    enemies,
    {
      binarySearchIterations: def.blinkResolveBinarySearchIterations!,
      partialMoveEpsilonPx: host.wu(def.blinkPartialMoveEpsilonWu!),
    },
  );
  const blinkFxR = playerR * 1.4;
  host.flashNova(px, py, blinkFxR, {
    blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave,
  });
  host.player.sprite.setPosition(landing.x, landing.y);
  const body = host.player.sprite.body as Phaser.Physics.Arcade.Body;
  body?.reset(landing.x, landing.y);
  body?.updateCenter();
  correctPlayerObstacleBlockerOverlap(
    host.player.sprite,
    host.obstacleBlockers,
  );
  if (landing.moved) {
    host.flashNova(landing.x, landing.y, blinkFxR, {
      blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave,
    });
  }
}

export function spawnDefenseIceWall(
  host: DefenseSpellDirectorHost,
  facingRad: number,
  def: SpellDefinition,
): void {
  const dist = host.wu(def.iceWallDistanceWu!);
  const cx = host.player.sprite.x + Math.cos(facingRad) * dist;
  const cy = host.player.sprite.y + Math.sin(facingRad) * dist;
  const perpX = -Math.sin(facingRad);
  const perpY = Math.cos(facingRad);
  const gap = host.wu(28);
  const key = COMBAT_FX_TEXTURE.spellIceBolt;
  for (let i = -1; i <= 1; i++) {
    const x = cx + perpX * gap * i;
    const y = cy + perpY * gap * i;
    const block = host.scene.physics.add.staticImage(x, y, key);
    const size = host.wu(20);
    block.setDisplaySize(size, size);
    block.setDepth(DEFENSE_RENDER_DEPTH.obstacleBlock);
    block.refreshBody();
    host.obstacleGroup.add(block);
    host.iceWallExpires.push({
      sprite: block,
      expiresAt: host.timeNow() + def.iceWallDurationMs!,
    });
  }
}

/** Remove expired ice-wall blocks from the obstacle group. */
export function tickDefenseIceWalls(host: DefenseSpellDirectorHost): void {
  const now = host.timeNow();
  host.iceWallExpires = host.iceWallExpires.filter((entry) => {
    if (entry.expiresAt > now) return true;
    playIceWallSegmentEndFx(
      host.scene,
      entry.sprite.x,
      entry.sprite.y,
      host.maskWorldObject,
    );
    host.obstacleGroup.remove(entry.sprite, true, true);
    return false;
  });
}
