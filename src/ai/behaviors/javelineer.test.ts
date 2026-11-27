import { describe, expect, it, vi } from "vitest";
import { DEFENSE_MAP } from "../../config";
import { buildNavGrid } from "../../pathfinding/grid";
import { testJavelineerCombat } from "../../test/fixtures/inlineCombat";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { javelineerBehavior } from "./javelineer";

function mockJavelineer(x: number, y: number) {
  return mockEnemyInstance({
    id: "j",
    defId: "javelineer",
    behavior: "javelineer",
    speedWu: testJavelineerCombat.maxRangeWu,
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
      wardPostHolding: false,
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
  const navGrid = buildNavGrid(
    [],
    DEFENSE_MAP.cellSize,
    DEFENSE_MAP.pathClearancePx,
  );

  it("retreats and arcs when player is inside min range", () => {
    const enemy = mockJavelineer(0, 0);
    enemy.nav.replanMs = 0;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: testJavelineerCombat.minRangeWu - 10,
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
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
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
    const dist = testJavelineerCombat.maxRangeWu - 8;
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
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
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

  it("flips strafe sign from left back to right when the timer elapses", () => {
    const enemy = mockJavelineer(0, 0);
    enemy.behaviorExtra.strafeSign = -1;
    enemy.behaviorExtra.strafeFlipMs = 8;
    const band =
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: band,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.strafeSign).toBe(1);
  });

  it("defaults the orbit flip interval when the tune is omitted", () => {
    const enemy = mockJavelineer(0, 0);
    const { orbitFlipMs: _omit, ...rest } = enemy.combatTuning.javelineer!;
    void _omit;
    enemy.combatTuning = {
      ...enemy.combatTuning,
      javelineer: rest,
    } as typeof enemy.combatTuning;
    enemy.behaviorExtra.strafeFlipMs = 0;
    const band =
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: band,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.strafeFlipMs).toBe(1400);
  });

  it("nudges slightly outward when a bit closer than ideal inside slack", () => {
    const enemy = mockJavelineer(0, 0);
    const ideal =
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: ideal - 16,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("nudges slightly inward when a bit farther than ideal inside slack", () => {
    const enemy = mockJavelineer(0, 0);
    const ideal =
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: ideal + 16,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("retreats while still inside the kite band when well inside ideal", () => {
    const enemy = mockJavelineer(0, 0);
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: testJavelineerCombat.minRangeWu + 20,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("approaches along a path when the player is beyond max range", () => {
    const enemy = mockJavelineer(0, 0);
    enemy.nav.replanMs = 0;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: testJavelineerCombat.maxRangeWu + 80,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("keeps moving when stacked on the player (zero separation)", () => {
    const enemy = mockJavelineer(0, 0);
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("stops strafing when both tangent probes leave the map", () => {
    const enemy = mockJavelineer(20_000, 0);
    const band =
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: 20_000 + band,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("chases the resolved goal when javelineer combat is untuned", () => {
    const enemy = mockJavelineer(0, 200);
    enemy.nav.replanMs = 0;
    delete (enemy.combatTuning as { javelineer?: unknown }).javelineer;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: 40,
      playerY: 200,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("retreats from the wall when targeting it from too close", () => {
    const enemy = mockJavelineer(0, -400);
    enemy.nav.replanMs = 0;
    const result = javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: 10_000,
      playerY: 10_000,
      deltaMs: 16,
    });
    expect(result.targetKind).toBe("wall");
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("approaches the wall when targeting it from beyond max range", () => {
    const enemy = mockJavelineer(0, 400);
    enemy.nav.replanMs = 0;
    const result = javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: 10_000,
      playerY: 10_000,
      deltaMs: 16,
    });
    expect(result.targetKind).toBe("wall");
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("strafes sideways when holding the wall at band range", () => {
    const enemy = mockJavelineer(0, -200);
    enemy.nav.replanMs = 0;
    const result = javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: 10_000,
      playerY: 10_000,
      deltaMs: 16,
    });
    expect(result.targetKind).toBe("wall");
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });
});
