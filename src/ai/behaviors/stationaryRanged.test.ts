import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STATIONARY_RANGED_COMBAT } from "../../core/enemyTuning";
import { createEnemyCombat } from "../../entities/EnemyCombat";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { stationaryRangedBehavior } from "./stationaryRanged";

function mockSentry(x: number, y: number, combat = createEnemyCombat()) {
  return mockEnemyInstance({
    id: "s",
    defId: "sentry_archer",
    behavior: "stationaryRanged",
    speed: 62,
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

  it("holds still when player is in attack range and ready", () => {
    const enemy = mockSentry(0, 0);
    const inRange = DEFAULT_STATIONARY_RANGED_COMBAT.attackTriggerRange - 20;
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

  it("chases when player is beyond attack range", () => {
    const enemy = mockSentry(0, 0);
    const outOfRange =
      DEFAULT_STATIONARY_RANGED_COMBAT.attackTriggerRange * 2 + 120;
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
      playerX: DEFAULT_STATIONARY_RANGED_COMBAT.attackTriggerRange + 40,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });
});