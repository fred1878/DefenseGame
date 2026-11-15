import { describe, expect, it, vi } from "vitest";
import { JAVELINEER_TUNING } from "../../config";
import type { EnemyInstance } from "../../entities/Enemy";
import { createEnemyCombat } from "../../entities/EnemyCombat";
import { createEnemyNav } from "../EnemyBrain";
import { javelineerBehavior } from "./javelineer";

function mockJavelineer(x: number, y: number): EnemyInstance {
  return {
    id: "j",
    defId: "javelineer",
    behavior: "javelineer",
    speed: JAVELINEER_TUNING.maxRange,
    damage: 10,
    textureKey: "enemy_javelineer",
    sprite: {
      x,
      y,
      setVelocity: vi.fn(),
    } as unknown as EnemyInstance["sprite"],
    damageable: {
      id: "j",
      hp: 20,
      maxHp: 20,
      alive: true,
      team: "enemy",
    },
    combat: createEnemyCombat(),
    nav: { ...createEnemyNav(), targetKind: "player" },
    behaviorExtra: { strafeSign: 1, strafeFlipMs: 500 },
    javelineer: { shotFired: false },
  };
}

describe("javelineerBehavior", () => {
  it("backs away when player is inside min range", () => {
    const enemy = mockJavelineer(0, 0);
    const grid = {
      blocked: () => false,
      width: 1,
      height: 1,
      cellSize: 40,
    } as unknown as import("../../pathfinding/grid").NavGrid;
    javelineerBehavior({
      enemy,
      nav: enemy.nav,
      grid,
      playerX: JAVELINEER_TUNING.minRange - 10,
      playerY: 0,
      deltaMs: 16,
    });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    expect(setVelocity).toHaveBeenCalled();
    const [vx] = setVelocity.mock.calls[0]!;
    expect(vx).toBeLessThan(0);
  });
});