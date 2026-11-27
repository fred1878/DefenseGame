import { maxNavObstacleClearancePx } from "../../entities/entityPhysics";
import { describe, expect, it, vi } from "vitest";
import { DEFENSE_MAP, DEFENSE_OBSTACLES } from "../../config";
import { buildNavGrid } from "../../pathfinding/grid";
import { testArrowRainCombat } from "../../test/fixtures/inlineCombat";
import { createEnemyNav } from "../brainShared";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { arrowRainArcherBehavior } from "./arrowRainArcher";
import * as BrainShared from "../brainShared";

function mockArcher(x: number, y: number) {
  return mockEnemyInstance({
    id: "a",
    defId: "arrow_rain_archer",
    behavior: "arrowRainArcher",
    speedWu: 52,
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
    const grid = buildNavGrid(
      [],
      DEFENSE_MAP.cellSize,
      maxNavObstacleClearancePx(),
    );
    const enemy = mockArcher(0, 0);
    enemy.nav.replanMs = 0;
    const preferred = testArrowRainCombat.preferredRangeWu - 30;
    arrowRainArcherBehavior({
      enemy,
      nav: enemy.nav,
      grid,
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

  it("replans a flee path when inside preferred range", () => {
    const grid = buildNavGrid(
      DEFENSE_OBSTACLES,
      DEFENSE_MAP.cellSize,
      maxNavObstacleClearancePx(),
    );
    const replanSpy = vi.spyOn(BrainShared, "replanEnemyPath");
    const enemy = mockArcher(0, 120);
    enemy.nav.replanMs = 0;
    const preferred = testArrowRainCombat.preferredRangeWu - 30;
    arrowRainArcherBehavior({
      enemy,
      nav: enemy.nav,
      grid,
      playerX: preferred,
      playerY: 0,
      deltaMs: 16,
    });
    expect(replanSpy).toHaveBeenCalled();
    replanSpy.mockRestore();
  });

  it("holds position in the attack band at preferred range", () => {
    const enemy = mockArcher(0, 0);
    const inBand =
      (testArrowRainCombat.preferredRangeWu +
        testArrowRainCombat.attackTriggerRangeWu) /
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
