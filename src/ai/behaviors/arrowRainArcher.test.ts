import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ARROW_RAIN_COMBAT } from "../../core/enemyTuning";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { arrowRainArcherBehavior } from "./arrowRainArcher";

function mockArcher(x: number, y: number) {
  return mockEnemyInstance({
    id: "a",
    defId: "arrow_rain_archer",
    behavior: "arrowRainArcher",
    speed: 52,
    textureKey: "enemy_arrow_rain_archer",
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
    arrowRain: {
      zoneX: 0,
      zoneY: 0,
      tickAccumulatorMs: 0,
      ticksDealt: 0,
    },
  });
}

describe("arrowRainArcherBehavior", () => {
  const openGrid = {
    blocked: () => false,
    width: 1,
    height: 1,
    cellSize: 40,
  } as unknown as import("../../pathfinding/grid").NavGrid;

  it("backs away when player is inside arrow rain preferred range", () => {
    const enemy = mockArcher(0, 0);
    const preferred = DEFAULT_ARROW_RAIN_COMBAT.preferredRange - 30;
    arrowRainArcherBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: preferred,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).not.toHaveBeenCalledWith(0, 0);
    const calls = (enemy.sprite.setVelocity as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    const [vx] = calls[0]!;
    expect(vx).toBeLessThan(0);
  });

  it("holds position in the attack band at preferred range", () => {
    const enemy = mockArcher(0, 0);
    const inBand =
      (DEFAULT_ARROW_RAIN_COMBAT.preferredRange +
        DEFAULT_ARROW_RAIN_COMBAT.attackTriggerRange) /
      2;
    arrowRainArcherBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: inBand,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });
});