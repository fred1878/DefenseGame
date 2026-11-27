import type Phaser from "phaser";
import { DEFENSE_MAP, PLAYER_AGGRO_RADIUS } from "../../config";
import { playerAggroRadiusWu } from "../../config/shadowformRuntime";
import { setEnemyChaseVelocity } from "../../combat/enemyKnockback";
import { worldUnit } from "../../config/worldScale";
import type { EnemyBehaviorExtra } from "../../entities/Enemy";
import {
  pathingPeerAgents,
  replanEnemyPath,
  resolveEnemyTarget,
  wallPathingPlayerClearancePx,
} from "../brainShared";
import type { EnemyBehavior, EnemyPeerAlly } from "./types";
import { applyChaseVelocity, playerChaseVelocityOpts } from "./movement";

const RANGED_PROTECT_BEHAVIORS = new Set([
  "arrowRainArcher",
  "stationaryRanged",
  "javelineer",
]);

/** Design px — within this distance of the screen goal counts as "at post". */
export const WARD_POST_HOLD_RADIUS_PX = 22;
/** Design px — player / protectee motion above this ends the grace window. */
export const WARD_POST_BREAK_MOVE_PX = 44;
/** Ms to stand still at post before allowing a full reposition. */
export const WARD_POST_GRACE_MS = 1600;
/** Hysteresis — stay "at post" until this far from the anchored goal (design px). */
export const WARD_POST_HOLD_EXIT_RADIUS_PX = 34;
/** Radians — ignore tiny aim jitter while holding (≈14°). */
export const WARD_POST_FACING_SLACK_RAD = (14 * Math.PI) / 180;

function wrapAngleRad(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Turn toward `targetRad`, keeping `currentRad` inside `slackRad` when already close. */
export function slewWardHoldFacing(
  currentRad: number,
  targetRad: number,
  slackRad: number,
): number {
  const delta = wrapAngleRad(targetRad - currentRad);
  if (Math.abs(delta) <= slackRad) return currentRad;
  return wrapAngleRad(targetRad);
}

export function pickWardProtectee(
  allies: readonly EnemyPeerAlly[] | undefined,
  ex: number,
  ey: number,
  protectRadius: number,
): EnemyPeerAlly | undefined {
  if (!allies?.length) return undefined;
  let best: EnemyPeerAlly | undefined;
  let bestDist = protectRadius;
  for (const ally of allies) {
    if (!RANGED_PROTECT_BEHAVIORS.has(ally.behavior)) continue;
    const d = Math.hypot(ally.x - ex, ally.y - ey);
    if (d < bestDist) {
      bestDist = d;
      best = ally;
    }
  }
  return best;
}

/** Escort slot: fixed offset from protectee along the threat line (player → protectee). */
export function wardScreenPoint(
  px: number,
  py: number,
  ax: number,
  ay: number,
  offsetWu: number,
  registry: Phaser.Data.DataManager,
): { x: number; y: number } {
  const dx = px - ax;
  const dy = py - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    return { x: ax, y: ay };
  }
  const step = worldUnit(offsetWu, registry);
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x: ax + ux * step,
    y: ay + uy * step,
  };
}

export function wardPostHoldBroken(
  extra: Pick<
    EnemyBehaviorExtra,
    | "wardPostSnapPlayerX"
    | "wardPostSnapPlayerY"
    | "wardPostSnapAllyX"
    | "wardPostSnapAllyY"
  >,
  playerX: number,
  playerY: number,
  allyX: number,
  allyY: number,
  breakMovePx: number,
  trackAlly: boolean,
): boolean {
  if (
    Math.hypot(
      playerX - extra.wardPostSnapPlayerX,
      playerY - extra.wardPostSnapPlayerY,
    ) > breakMovePx
  ) {
    return true;
  }
  if (
    trackAlly &&
    Math.hypot(
      allyX - extra.wardPostSnapAllyX,
      allyY - extra.wardPostSnapAllyY,
    ) > breakMovePx
  ) {
    return true;
  }
  return false;
}

export type WardPostHoldDecision = {
  hold: boolean;
  skipReplan: boolean;
  /** First frame anchored at post — snap aim instead of angular deadband. */
  snapFacing: boolean;
};

/** Grace + goal deadband while screening for a ranged ally. */
export function evaluateWardPostHold(
  extra: EnemyBehaviorExtra,
  deltaMs: number,
  atPost: boolean,
  goalX: number,
  goalY: number,
  playerX: number,
  playerY: number,
  allyX: number,
  allyY: number,
  breakMovePx: number,
): WardPostHoldDecision {
  if (!atPost) {
    extra.wardPostWasInHoldRadius = false;
    extra.wardPostGraceMs = 0;
    return { hold: false, skipReplan: false, snapFacing: false };
  }

  const freshlyArrived = !extra.wardPostWasInHoldRadius;
  extra.wardPostWasInHoldRadius = true;

  if (freshlyArrived || extra.wardPostGraceMs <= 0) {
    if (freshlyArrived) {
      extra.wardPostGraceMs = WARD_POST_GRACE_MS;
      extra.wardPostSnapPlayerX = playerX;
      extra.wardPostSnapPlayerY = playerY;
      extra.wardPostSnapAllyX = allyX;
      extra.wardPostSnapAllyY = allyY;
      extra.wardPostAnchorGoalX = goalX;
      extra.wardPostAnchorGoalY = goalY;
    }
  }

  const snapBroken = wardPostHoldBroken(
    extra,
    playerX,
    playerY,
    allyX,
    allyY,
    breakMovePx,
    true,
  );

  if (extra.wardPostGraceMs > 0) {
    extra.wardPostGraceMs = Math.max(0, extra.wardPostGraceMs - deltaMs);
    if (snapBroken) {
      extra.wardPostGraceMs = 0;
      extra.wardPostAnchorGoalX = goalX;
      extra.wardPostAnchorGoalY = goalY;
      return { hold: false, skipReplan: false, snapFacing: false };
    }
    if (extra.wardPostGraceMs > 0) {
      return { hold: true, skipReplan: true, snapFacing: freshlyArrived };
    }
  }

  if (snapBroken) {
    extra.wardPostAnchorGoalX = goalX;
    extra.wardPostAnchorGoalY = goalY;
    return { hold: false, skipReplan: false, snapFacing: false };
  }

  const goalDrift = Math.hypot(
    goalX - extra.wardPostAnchorGoalX,
    goalY - extra.wardPostAnchorGoalY,
  );
  if (goalDrift < breakMovePx) {
    return { hold: true, skipReplan: true, snapFacing: freshlyArrived };
  }

  return { hold: false, skipReplan: false, snapFacing: false };
}

export const wardBehavior: EnemyBehavior = (ctx) => {
  const {
    enemy,
    nav,
    grid,
    playerX,
    playerY,
    deltaMs,
    peerAgents,
    peerAllies,
  } = ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene.registry;
  const ward = enemy.combatTuning.ward;
  const waypointRadius = worldUnit(DEFENSE_MAP.pathWaypointRadius, reg);
  const holdRadius = worldUnit(WARD_POST_HOLD_RADIUS_PX, reg);
  const holdExitRadius = worldUnit(WARD_POST_HOLD_EXIT_RADIUS_PX, reg);
  const breakMovePx = worldUnit(WARD_POST_BREAK_MOVE_PX, reg);
  const aggro = playerAggroRadiusWu(
    ward?.playerAggroRadiusWu ?? PLAYER_AGGRO_RADIUS,
  );
  const extra = enemy.behaviorExtra;
  extra.wardPostHolding = false;

  const protectee = pickWardProtectee(
    peerAllies,
    ex,
    ey,
    worldUnit(ward!.protectRadiusWu, reg),
  );

  let goalX: number;
  let goalY: number;
  let targetKind: "player" | "wall" = "wall";

  if (protectee) {
    const screen = wardScreenPoint(
      playerX,
      playerY,
      protectee.x,
      protectee.y,
      ward!.screenOffsetWu,
      reg,
    );
    goalX = screen.x;
    goalY = screen.y;
    const distPlayer = Math.hypot(playerX - ex, playerY - ey);
    if (distPlayer <= worldUnit(aggro, reg)) {
      targetKind = "player";
    }
  } else {
    const resolved = resolveEnemyTarget(
      nav,
      grid,
      ex,
      ey,
      playerX,
      playerY,
      deltaMs,
      worldUnit(aggro, reg),
      ctx.objective ?? "defendWall",
      reg,
    );
    goalX = resolved.goalX;
    goalY = resolved.goalY;
    targetKind = resolved.targetKind;
    nav.targetKind = resolved.targetKind;
  }

  const distLiveGoal = Math.hypot(goalX - ex, goalY - ey);
  const distAnchorGoal = Math.hypot(
    extra.wardPostAnchorGoalX - ex,
    extra.wardPostAnchorGoalY - ey,
  );
  const atPost = extra.wardPostWasInHoldRadius
    ? distAnchorGoal <= holdExitRadius
    : distLiveGoal <= holdRadius;

  let postHold: WardPostHoldDecision | undefined;
  if (protectee) {
    postHold = evaluateWardPostHold(
      extra,
      deltaMs,
      atPost,
      goalX,
      goalY,
      playerX,
      playerY,
      protectee.x,
      protectee.y,
      breakMovePx,
    );
    if (postHold.hold) {
      extra.wardPostHolding = true;
      setEnemyChaseVelocity(enemy, 0, 0);
      const aim = Math.atan2(playerY - ey, playerX - ex);
      enemy.combat.facing = postHold.snapFacing
        ? aim
        : slewWardHoldFacing(
            enemy.combat.facing,
            aim,
            WARD_POST_FACING_SLACK_RAD,
          );
      return { targetX: goalX, targetY: goalY, targetKind };
    }
  }

  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  const skipReplan = postHold?.skipReplan ?? false;

  if (!skipReplan && (nav.replanMs <= 0 || nav.path.length === 0)) {
    replanEnemyPath(
      nav,
      grid,
      ex,
      ey,
      goalX,
      goalY,
      waypointRadius,
      pathingPeerAgents(
        peerAgents,
        targetKind,
        playerX,
        playerY,
        wallPathingPlayerClearancePx(enemy.sprite.scene.registry),
      ),
      enemy,
    );
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  let moveX = goalX;
  let moveY = goalY;
  if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
    const wp = nav.path[nav.pathIndex]!;
    const d = Math.hypot(wp.x - ex, wp.y - ey);
    if (d <= waypointRadius) {
      nav.pathIndex += 1;
    }
    const nextWp = nav.path[nav.pathIndex];
    if (nextWp) {
      moveX = nextWp.x;
      moveY = nextWp.y;
    }
  }

  applyChaseVelocity(
    enemy,
    moveX,
    moveY,
    0.82,
    playerChaseVelocityOpts(enemy, {
      nav,
      deltaMs,
      targetKind,
      playerX,
      playerY,
      peerAllies,
    }),
  );

  return { targetX: goalX, targetY: goalY, targetKind };
};
