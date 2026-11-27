import { tuning } from "../../tuning/gameTuning";
import { describe, expect, it, vi } from "vitest";
import { northWallAttackY } from "../../config";
import { wallMeleeApproachStandoffWu } from "../../core/enemyTuning";
import { testWallCombat } from "../../test/fixtures/inlineCombat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EnemyDefInput } from "../../core/data/normalizeEnemy";
import { normalizeEnemyRow } from "../../core/data/normalizeEnemy";
import { applyEnemyBodyRadii } from "../../entities/entityPhysics";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { createRangedHybridCombatState } from "../../entities/EnemyRangedCombat";

const enemiesRaw = JSON.parse(
  readFileSync(resolve("public/data/enemies.json"), "utf8"),
) as Record<string, EnemyDefInput>;
const enemyDefs = Object.fromEntries(
  Object.entries(enemiesRaw).map(([id, row]) => [
    id,
    normalizeEnemyRow(id, row),
  ]),
);
import { createEnemyNav } from "../brainShared";
import {
  applyChaseVelocity,
  applyDirectVelocity,
  attackMovementScale,
  applyWallMeleeHold,
  commitPlayerChasePathGoal,
  meleePackPlayerAnchor,
  playerMeleeChaseHoldPoint,
  playerMeleeChaseStandoffCenterDist,
  shouldHoldAtPlayerMelee,
  shouldHoldMeleeChaseChordBlocked,
  shouldHoldAtWallMelee,
  wallMeleeDistToAttackPlane,
  wallMeleeStandoffY,
} from "./movement";

describe("melee pack anchor and unreachable stickiness", () => {
  it("keeps pathGoalReached false until standoff after an unreachable replan", () => {
    const nav = createEnemyNav();
    nav.pathGoalReached = false;
    commitPlayerChasePathGoal(nav, true, false, false);
    expect(nav.pathGoalReached).toBe(false);
    commitPlayerChasePathGoal(nav, true, false, true);
    expect(nav.pathGoalReached).toBe(true);
  });

  it("ignores small player nudges while the anchor is active", () => {
    const nav = createEnemyNav();
    const anchor = meleePackPlayerAnchor(nav, 0, 0, true, 80);
    expect(anchor).toEqual({ x: 0, y: 0 });
    const nudged = meleePackPlayerAnchor(nav, 12, -8, true, 80);
    expect(nudged).toEqual({ x: 0, y: 0 });
    const far = meleePackPlayerAnchor(nav, 120, 0, true, 80);
    expect(far).toEqual({ x: 120, y: 0 });
  });
});

describe("player melee standoff", () => {
  it("holds when center distance is within body contact plus gap", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    const standoff = playerMeleeChaseStandoffCenterDist(enemy);
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    const playerX = standoff - 1;
    expect(shouldHoldAtPlayerMelee(enemy, "player", playerX, 0)).toBe(true);
    expect(shouldHoldAtPlayerMelee(enemy, "wall", playerX, 0)).toBe(false);
  });

  it("stops chase intent at standoff but keeps knockback slide", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      knockbackVx: 24,
      knockbackVy: 0,
    });
    const standoff = playerMeleeChaseStandoffCenterDist(enemy);
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    applyChaseVelocity(enemy, standoff, 0, 1, {
      targetKind: "player",
      playerX: standoff,
      playerY: 0,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(24, 0);
  });

  it("still closes when outside standoff", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    const standoff = playerMeleeChaseStandoffCenterDist(enemy);
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    applyChaseVelocity(enemy, standoff + 40, 0, 1, {
      targetKind: "player",
      playerX: standoff + 40,
      playerY: 0,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const [vx] = setVelocity.mock.calls[0]!;
    expect(vx).toBeGreaterThan(0);
  });

  it("detects a closer ally body on the hold chord", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    enemy.sprite.x = -80;
    enemy.sprite.y = 0;
    const playerX = 0;
    const playerY = 0;
    const peers = [{ x: -20, y: 0, defId: "grunt" }];
    expect(
      shouldHoldMeleeChaseChordBlocked(enemy, playerX, playerY, peers),
    ).toBe(true);
  });

  it("uses per-defId body radius for chord width", () => {
    applyEnemyBodyRadii({
      ...enemyDefs,
      chord_wide: { ...enemyDefs.grunt!, bodyRadiusWu: 50 },
      chord_narrow: { ...enemyDefs.grunt!, bodyRadiusWu: 1 },
    });
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    enemy.sprite.x = -60;
    enemy.sprite.y = 0;
    const peer = { x: -26, y: 48 };
    expect(
      shouldHoldMeleeChaseChordBlocked(enemy, 0, 0, [
        { ...peer, defId: "chord_wide" },
      ]),
    ).toBe(true);
    expect(
      shouldHoldMeleeChaseChordBlocked(enemy, 0, 0, [
        { ...peer, defId: "chord_narrow" },
      ]),
    ).toBe(false);
    applyEnemyBodyRadii(enemyDefs);
  });

  it("does not chord-block when the peer is not closer to the player", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    enemy.sprite.x = -30;
    enemy.sprite.y = 0;
    const peers = [{ x: -80, y: 0, defId: "grunt" }];
    expect(shouldHoldMeleeChaseChordBlocked(enemy, 0, 0, peers)).toBe(false);
  });

  it("blocks when a front ally is between hold and player on a rear approach", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 60;
    const playerX = 0;
    const playerY = 0;
    const peers = [{ x: -18, y: 0, defId: "grunt" }];
    expect(
      shouldHoldMeleeChaseChordBlocked(enemy, playerX, playerY, peers),
    ).toBe(true);
  });

  it("zeros chase on a direct player close when chord is blocked", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 0;
    const playerX = 0;
    const playerY = 0;
    const peers = [{ x: -25, y: 0, defId: "grunt" }];
    applyChaseVelocity(enemy, playerX, playerY, 1, {
      targetKind: "player",
      playerX,
      playerY,
      meleeChasePeers: peers,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("keeps velocity toward a path waypoint when chord is blocked", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 0;
    const playerX = 0;
    const playerY = 0;
    const peers = [{ x: -25, y: 0, defId: "grunt" }];
    applyChaseVelocity(enemy, -40, 50, 1, {
      targetKind: "player",
      playerX,
      playerY,
      meleeChasePeers: peers,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const [vx, vy] = setVelocity.mock.calls[0]!;
    expect(Math.hypot(vx, vy)).toBeGreaterThan(0);
    expect(vy).toBeGreaterThan(0);
  });

  it("still closes when chord to the hold point is clear", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 0;
    const playerX = 0;
    const playerY = 0;
    const peers = [{ x: -100, y: 40, defId: "grunt" }];
    applyChaseVelocity(enemy, playerX, playerY, 1, {
      targetKind: "player",
      playerX,
      playerY,
      meleeChasePeers: peers,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const [vx] = setVelocity.mock.calls[0]!;
    expect(vx).toBeGreaterThan(0);
  });

  it("does not apply standoff to non-melee collision archetypes", () => {
    const enemy = mockEnemyInstance({ behavior: "arrowRainArcher" });
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    expect(shouldHoldAtPlayerMelee(enemy, "player", 10, 0)).toBe(false);
  });
});

describe("wall melee hold helpers", () => {
  it("holds when idle on wall cooldown inside trigger range", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      sprite: {
        x: 40,
        y: 0,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    enemy.sprite.y = wallMeleeStandoffY(enemy);
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 400;
    expect(shouldHoldAtWallMelee(enemy, "wall")).toBe(true);
  });

  it("does not hold when still outside wall trigger range", () => {
    const enemy = mockEnemyInstance({ behavior: "wallSiege" });
    enemy.sprite.y = northWallAttackY() + 200;
    enemy.combat.cooldownMs = 200;
    expect(shouldHoldAtWallMelee(enemy, "wall")).toBe(false);
  });

  it("keeps closing while idle in the trigger band but outside hit range", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    const wall = testWallCombat;
    enemy.sprite.y =
      northWallAttackY() + (wall.hitRangeWu + wall.triggerRangeWu) / 2;
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 0;
    expect(wallMeleeDistToAttackPlane(enemy)).toBeGreaterThan(wall.hitRangeWu);
    expect(wallMeleeDistToAttackPlane(enemy)).toBeLessThanOrEqual(
      wall.triggerRangeWu,
    );
    expect(shouldHoldAtWallMelee(enemy, "wall")).toBe(false);
  });

  it("places standoff inside default wall hit range", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    const standoff = wallMeleeApproachStandoffWu(testWallCombat);
    expect(standoff).toBeLessThanOrEqual(testWallCombat.hitRangeWu);
    enemy.sprite.x = 12;
    const y = wallMeleeStandoffY(enemy);
    expect(y - northWallAttackY()).toBe(standoff);
  });

  it("does not hold when chasing the player", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    enemy.sprite.y = wallMeleeStandoffY(enemy);
    enemy.combat.cooldownMs = 300;
    expect(shouldHoldAtWallMelee(enemy, "player")).toBe(false);
  });

  it("bruiser keeps half chase speed during melee windup", () => {
    const enemy = mockEnemyInstance({ behavior: "bruiser", speedWu: 100 });
    enemy.combat.phase = "windup";
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    applyChaseVelocity(enemy, 100, 0, 1);
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const [vx] = setVelocity.mock.calls[0]!;
    expect(vx).toBeCloseTo(50, 1);
  });

  it("wall transition blends chase intent only, not residual knockback", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      speedWu: 100,
      knockbackVx: 80,
      knockbackVy: 0,
    });
    enemy.nav.wallTransitionMs = tuning("enemyAi").wallVelocityBlendMs;
    const body = { velocity: { x: 140, y: 0 } };
    (enemy.sprite as unknown as { body: typeof body }).body = body;
    applyChaseVelocity(enemy, 200, 0, 1, {
      nav: enemy.nav,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const [vx] = setVelocity.mock.calls.at(-1)!;
    expect(vx).toBeLessThan(160);
    expect(vx).toBeGreaterThan(130);
  });

  it("meleeChaser holds chase at zero while attacking but keeps knockback slide", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      speedWu: 100,
      knockbackVx: 30,
      knockbackVy: 0,
    });
    enemy.combat.phase = "windup";
    applyChaseVelocity(enemy, 100, 0, 1);
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(30, 0);
  });

  it("zeros velocity and snaps north of standoff back to approach line", () => {
    const enemy = mockEnemyInstance({ behavior: "wallSiege" });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const approachY = wallMeleeStandoffY(enemy);
    enemy.sprite.y = approachY - 8;
    applyWallMeleeHold(enemy);
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
    expect(enemy.sprite.y).toBe(approachY);
  });
});

describe("movement remaining branches", () => {
  it("throws when melee standoff is requested without a melee table", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    delete (enemy.combatTuning as { melee?: unknown }).melee;
    expect(() => playerMeleeChaseStandoffCenterDist(enemy)).toThrow(
      /combat.melee/,
    );
  });

  it("holds at the current position when stacked on the player", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    enemy.sprite.x = 12;
    enemy.sprite.y = 8;
    expect(playerMeleeChaseHoldPoint(enemy, 12, 8)).toEqual({ x: 12, y: 8 });
  });

  it("records path-goal reachability for later standoff checks", () => {
    const nav = createEnemyNav();
    nav.pathGoalReached = true;
    commitPlayerChasePathGoal(nav, false, true, false);
    expect(nav.pathGoalReached).toBe(false);
    commitPlayerChasePathGoal(nav, true, false, true);
    expect(nav.pathGoalReached).toBe(true);
    commitPlayerChasePathGoal(nav, true, false, false);
    expect(nav.pathGoalReached).toBe(false);
    commitPlayerChasePathGoal(nav, true, true, false);
    expect(nav.pathGoalReached).toBe(true);
  });

  it("holds at the wall while a swing is in progress, without snapping south", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    const approachY = wallMeleeStandoffY(enemy);
    enemy.sprite.y = approachY + 2;
    enemy.combat.phase = "windup";
    expect(shouldHoldAtWallMelee(enemy, "wall")).toBe(true);
    applyWallMeleeHold(enemy);
    expect(enemy.sprite.y).toBe(approachY + 2);
  });

  it("zeros a degenerate direct velocity", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      speedWu: 80,
    });
    applyDirectVelocity(enemy, 0, 0, 1);
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("applies status speed fallback and blocks a swinging chaser", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser", speedWu: 100 });
    delete (enemy as { statusSpeedMul?: number }).statusSpeedMul;
    enemy.combat.phase = "idle";
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    applyChaseVelocity(enemy, 100, 0, 1);
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalled();
    const [vx] = setVelocity.mock.calls.at(-1)!;
    expect(vx).toBeGreaterThan(0);

    setVelocity.mockClear();
    enemy.combat.phase = "windup";
    applyDirectVelocity(enemy, 1, 0, 1);
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("holds chase velocity at the wall when the target is the wall", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    const approachY = wallMeleeStandoffY(enemy);
    enemy.sprite.y = approachY + 2;
    enemy.combat.phase = "idle";
    applyChaseVelocity(enemy, enemy.sprite.x, approachY, 1, {
      targetKind: "wall",
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });
});

describe("data-driven attack movement", () => {
  function lastVx(enemy: ReturnType<typeof mockEnemyInstance>): number {
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const call = setVelocity.mock.calls.at(-1);
    if (!call) throw new Error("setVelocity not called");
    return call[0] as number;
  }

  it("keeps shipped melee defaults: chasers still, bruisers at half speed", () => {
    const chaser = mockEnemyInstance({ behavior: "meleeChaser", speedWu: 100 });
    chaser.combat.phase = "windup";
    expect(attackMovementScale(chaser)).toBe(0);
    applyChaseVelocity(chaser, 100, 0, 1);
    expect(lastVx(chaser)).toBe(0);

    const bruiser = mockEnemyInstance({ behavior: "bruiser", speedWu: 100 });
    bruiser.combat.phase = "recovery";
    expect(attackMovementScale(bruiser)).toBe(0.5);
    applyChaseVelocity(bruiser, 100, 0, 1);
    expect(lastVx(bruiser)).toBeCloseTo(50, 1);
  });

  it("applies per-phase multipliers from the executing melee kit", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser", speedWu: 100 });
    enemy.combatTuning.melee = {
      ...enemy.combatTuning.melee!,
      attackMovement: { windupMul: 0.2, activeMul: 0.35, recoveryMul: 0.8 },
    };
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;

    enemy.combat.phase = "idle";
    expect(attackMovementScale(enemy)).toBe(1);
    applyChaseVelocity(enemy, 100, 0, 1);
    expect(lastVx(enemy)).toBeCloseTo(100, 1);

    enemy.combat.phase = "windup";
    applyChaseVelocity(enemy, 100, 0, 1);
    expect(lastVx(enemy)).toBeCloseTo(20, 1);

    enemy.combat.phase = "active";
    applyDirectVelocity(enemy, 1, 0, 1);
    expect(lastVx(enemy)).toBeCloseTo(35, 1);

    enemy.combat.phase = "recovery";
    applyChaseVelocity(enemy, 100, 0, 1);
    expect(lastVx(enemy)).toBeCloseTo(80, 1);
  });

  it("uses the hybrid kit for the mode currently executing", () => {
    const enemy = mockEnemyInstance({
      behavior: "rangedHybrid",
      defId: "reaver",
      speedWu: 100,
    });
    enemy.rangedHybrid = createRangedHybridCombatState();
    enemy.combatTuning.melee = {
      ...enemy.combatTuning.melee!,
      attackMovement: { windupMul: 0.25, activeMul: 0.25, recoveryMul: 0.25 },
    };
    enemy.combatTuning.stationaryRanged = {
      ...enemy.combatTuning.stationaryRanged!,
      attackMovement: { windupMul: 0.6, activeMul: 0.6, recoveryMul: 0.6 },
    };
    enemy.combat.phase = "windup";
    enemy.rangedHybrid.mode = "melee";
    expect(attackMovementScale(enemy)).toBe(0.25);
    applyChaseVelocity(enemy, 100, 0, 1);
    expect(lastVx(enemy)).toBeCloseTo(25, 1);

    enemy.rangedHybrid.mode = "ranged";
    expect(attackMovementScale(enemy)).toBe(0.6);
    applyChaseVelocity(enemy, 100, 0, 1);
    expect(lastVx(enemy)).toBeCloseTo(60, 1);
  });

  it("treats a missing attackMovement block as a full hold while attacking", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser", speedWu: 100 });
    delete (enemy.combatTuning.melee as { attackMovement?: unknown })
      .attackMovement;
    enemy.combat.phase = "active";
    expect(attackMovementScale(enemy)).toBe(0);
    applyDirectVelocity(enemy, 1, 0, 1);
    expect(lastVx(enemy)).toBe(0);
  });

  it("reads attackMovement from the ranged kit that is attacking", () => {
    const cases = [
      {
        behavior: "arrowRainArcher" as const,
        defId: "arrow_rain_archer",
        kit: "arrowRain" as const,
      },
      {
        behavior: "javelineer" as const,
        defId: "javelineer",
        kit: "javelineer" as const,
      },
      {
        behavior: "stationaryRanged" as const,
        defId: "sentry_archer",
        kit: "stationaryRanged" as const,
      },
      {
        behavior: "lobber" as const,
        defId: "lobber",
        kit: "lobber" as const,
      },
    ];
    for (const { behavior, defId, kit } of cases) {
      const enemy = mockEnemyInstance({ behavior, defId, speedWu: 100 });
      const block = enemy.combatTuning[kit];
      if (!block || !("attackMovement" in block)) {
        throw new Error(`expected ${kit} attackMovement`);
      }
      block.attackMovement = {
        windupMul: 0.4,
        activeMul: 0.4,
        recoveryMul: 0.4,
      };
      enemy.combat.phase = "active";
      expect(attackMovementScale(enemy), behavior).toBe(0.4);
      applyDirectVelocity(enemy, 1, 0, 1);
      expect(lastVx(enemy), behavior).toBeCloseTo(40, 1);
    }
  });

  it("allows a caller to override the phase scale", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser", speedWu: 100 });
    enemy.combat.phase = "windup";
    applyDirectVelocity(enemy, 1, 0, 0.5, { phaseScale: 1 });
    expect(lastVx(enemy)).toBeCloseTo(50, 1);
  });
});

describe("applyDirectVelocity leftover branches", () => {
  it("uses a status speed of 1 when none is set", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser", speedWu: 100 });
    delete (enemy as { statusSpeedMul?: number }).statusSpeedMul;
    enemy.combat.phase = "idle";
    applyDirectVelocity(enemy, 1, 0, 1);
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalled();
    const [vx] = setVelocity.mock.calls.at(-1)!;
    expect(vx).toBeGreaterThan(0);
  });
});

describe("shouldHoldMeleeChaseChordBlocked leftover branches", () => {
  it("treats a zero-length hold chord as a point check", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    const playerX = 0;
    const playerY = 0;
    enemy.sprite.x = -80;
    enemy.sprite.y = 0;
    const hold = playerMeleeChaseHoldPoint(enemy, playerX, playerY);
    enemy.sprite.x = hold.x;
    enemy.sprite.y = hold.y;
    const peers = [{ x: hold.x / 2, y: 0, defId: "grunt" }];
    // Enemy is already on the hold point, so the hold-chord segment has
    // zero length. The closer peer still sits on the player line.
    expect(
      shouldHoldMeleeChaseChordBlocked(enemy, playerX, playerY, peers),
    ).toBe(true);
  });
});
