import { describe, expect, it, vi } from "vitest";
import { testStationaryRangedCombat } from "../../test/fixtures/inlineCombat";
import { createEnemyCombat } from "../../entities/EnemyCombat";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { stationaryRangedBehavior } from "./stationaryRanged";

function mockSentry(x: number, y: number, combat = createEnemyCombat()) {
  return mockEnemyInstance({
    id: "s",
    defId: "sentry_archer",
    behavior: "stationaryRanged",
    speedWu: 62,
    combat,
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
  });
}

describe("stationaryRangedBehavior", () => {
  const openGrid = {
    blocked: () => false,
    width: 1,
    height: 1,
    cellSize: 40,
  } as unknown as import("../../pathfinding/grid").NavGrid;

  it("holds still when player is in the preferred band", () => {
    const enemy = mockSentry(0, 0);
    const inRange =
      (testStationaryRangedCombat.preferredRangeWu +
        testStationaryRangedCombat.attackTriggerRangeWu) /
      2;
    stationaryRangedBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: inRange,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("backs off when player is inside preferred range", () => {
    const enemy = mockSentry(0, 0);
    stationaryRangedBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: testStationaryRangedCombat.preferredRangeWu - 40,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalled();
    expect(setVelocity).not.toHaveBeenCalledWith(0, 0);
  });

  it("chases when player is beyond attack range", () => {
    const enemy = mockSentry(0, 0);
    const outOfRange =
      testStationaryRangedCombat.attackTriggerRangeWu * 2 + 120;
    enemy.nav = {
      ...enemy.nav,
      targetKind: "player",
      lastKnownPlayerX: outOfRange,
      lastKnownPlayerY: 0,
      chaseMemoryMs: 4000,
    };
    stationaryRangedBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: outOfRange,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalled();
    expect(setVelocity).not.toHaveBeenCalledWith(0, 0);
  });

  it("holds still during windup", () => {
    const combat = createEnemyCombat();
    combat.phase = "windup";
    const enemy = mockSentry(0, 0, combat);
    stationaryRangedBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: testStationaryRangedCombat.attackTriggerRangeWu + 40,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });
});
