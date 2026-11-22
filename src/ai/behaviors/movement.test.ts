import { describe, expect, it, vi } from "vitest";
import { northWallAttackY, WALL_VELOCITY_BLEND_MS } from "../../config";
import { wallMeleeApproachStandoffPx } from "../../core/enemyTuning";
import { testWallCombat } from "../../test/fixtures/inlineCombat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EnemyDefInput } from "../../core/normalizeEnemy";
import { normalizeEnemyRow } from "../../core/normalizeEnemy";
import {
  applyEnemyBodyRadii,
  enemyCollisionBodyRadius,
} from "../../entities/entityPhysics";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";

const enemiesRaw = JSON.parse(
  readFileSync(resolve("public/data/enemies.json"), "utf8"),
) as Record<string, EnemyDefInput>;
const enemyDefs = Object.fromEntries(
  Object.entries(enemiesRaw).map(([id, row]) => [id, normalizeEnemyRow(id, row)]),
);
import {
  applyChaseVelocity,
  applyWallMeleeHold,
  playerMeleeChaseStandoffCenterDist,
  shouldHoldAtPlayerMelee,
  shouldHoldMeleeChaseChordBlocked,
  shouldHoldAtWallMelee,
  wallMeleeDistToAttackPlane,
  wallMeleeStandoffY,
} from "./movement";

describe("player melee standoff", () => {
  it("holds when center distance is within body contact plus gap", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser", defId: "grunt" });
    const standoff = playerMeleeChaseStandoffCenterDist(enemy);
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    const playerX = standoff - 1;
    expect(
      shouldHoldAtPlayerMelee(enemy, "player", playerX, 0),
    ).toBe(true);
    expect(
      shouldHoldAtPlayerMelee(enemy, "wall", playerX, 0),
    ).toBe(false);
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
      speed: 80,
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
      chord_wide: { ...enemyDefs.grunt!, bodyRadius: 50 },
      chord_narrow: { ...enemyDefs.grunt!, bodyRadius: 1 },
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

  it("reads bodyRadius from JSON for grunt and bruiser", () => {
    expect(enemyCollisionBodyRadius("grunt")).toBe(28);
    expect(enemyCollisionBodyRadius("bruiser")).toBe(21);
  });

  it("does not chord-block when the peer is not closer to the player", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    enemy.sprite.x = -30;
    enemy.sprite.y = 0;
    const peers = [{ x: -80, y: 0, defId: "grunt" }];
    expect(
      shouldHoldMeleeChaseChordBlocked(enemy, 0, 0, peers),
    ).toBe(false);
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
      speed: 80,
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
      speed: 80,
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
      speed: 80,
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
    enemy.sprite.y = northWallAttackY() + (wall.hitRange + wall.triggerRange) / 2;
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 0;
    expect(wallMeleeDistToAttackPlane(enemy)).toBeGreaterThan(wall.hitRange);
    expect(wallMeleeDistToAttackPlane(enemy)).toBeLessThanOrEqual(wall.triggerRange);
    expect(shouldHoldAtWallMelee(enemy, "wall")).toBe(false);
  });

  it("places standoff inside default wall hit range", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    const standoff = wallMeleeApproachStandoffPx(testWallCombat);
    expect(standoff).toBeLessThanOrEqual(testWallCombat.hitRange);
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
    const enemy = mockEnemyInstance({ behavior: "bruiser", speed: 100 });
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
      speed: 100,
      knockbackVx: 80,
      knockbackVy: 0,
    });
    enemy.nav.wallTransitionMs = WALL_VELOCITY_BLEND_MS;
    const body = { velocity: { x: 140, y: 0 } };
    (
      enemy.sprite as unknown as { body: typeof body }
    ).body = body;
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
      speed: 100,
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