import { describe, expect, it, vi } from "vitest";
import { testJavelineerCombat } from "../../test/fixtures/inlineCombat";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { javelineerBehavior } from "./javelineer";

function mockJavelineer(x: number, y: number) {
  return mockEnemyInstance({
    id: "j",
    defId: "javelineer",
    behavior: "javelineer",
    speed: testJavelineerCombat.maxRange,
    textureKey: "enemy_javelineer",
    sprite: {
      x,
      y,
      setVelocity: vi.fn(),
      scene: {
        registry: {
          get: () => undefined,
        },
      },
    } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    nav: { ...createEnemyNav(), targetKind: "player" },
    behaviorExtra: {
      strafeSign: 1,
      strafeFlipMs: 500,
      chargeWindupMs: 0,
      chargeActiveMs: 0,
      chargeCooldownMs: 0,
      chargeAimX: 0,
      chargeAimY: 0,
      chargeDashDirX: 0,
      chargeDashDirY: 0,
      chargeHitThisDash: false,
      wardPostGraceMs: 0,
      wardPostSnapPlayerX: 0,
      wardPostSnapPlayerY: 0,
      wardPostSnapAllyX: 0,
      wardPostSnapAllyY: 0,
      wardPostAnchorGoalX: 0,
      wardPostAnchorGoalY: 0,
      wardPostWasInHoldRadius: false,
    },
    javelineer: { shotFired: false },
  });
}

describe("javelineerBehavior", () => {
  const openGrid = {
    blocked: () => false,
    width: 1,
    height: 1,
    cellSize: 40,
  } as unknown as import("../../pathfinding/grid").NavGrid;

  it("retreats and arcs when player is inside min range", () => {
    const enemy = mockJavelineer(0, 0);
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: testJavelineerCombat.minRange - 10,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalled();
    const [vx, vy] = setVelocity.mock.calls[0]!;
    expect(vx).toBeLessThan(0);
    expect(Math.abs(vy)).toBeGreaterThan(0);
  });

  it("strafes tangentially when at ideal kite distance", () => {
    const enemy = mockJavelineer(0, 0);
    const band =
      (testJavelineerCombat.minRange + testJavelineerCombat.maxRange) /
      2;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: band,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const [vx, vy] = setVelocity.mock.calls[0]!;
    expect(Math.abs(vy)).toBeGreaterThan(0);
    expect(Math.abs(vx)).toBeLessThan(Math.abs(vy));
  });

  it("approaches while strafing when beyond ideal range inside the band", () => {
    const enemy = mockJavelineer(0, 0);
    const dist = testJavelineerCombat.maxRange - 8;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: dist,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    const [vx, vy] = setVelocity.mock.calls[0]!;
    expect(vx).toBeGreaterThan(0);
    expect(Math.abs(vy)).toBeGreaterThan(0);
  });

  it("flips strafe sign after orbit timer elapses", () => {
    const enemy = mockJavelineer(0, 0);
    enemy.behaviorExtra.strafeFlipMs = 8;
    const band =
      (testJavelineerCombat.minRange + testJavelineerCombat.maxRange) /
      2;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: band,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.strafeSign).toBe(-1);
  });
});