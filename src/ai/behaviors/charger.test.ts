import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHARGER_COMBAT } from "../../core/enemyTuning";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { chargerBehavior } from "./charger";

describe("chargerBehavior", () => {
  const openGrid = {
    blocked: () => false,
    width: 1,
    height: 1,
    cellSize: 40,
  } as unknown as import("../../pathfinding/grid").NavGrid;

  it("starts dash windup when player is in trigger range", () => {
    const enemy = mockEnemyInstance({
      behavior: "charger",
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    enemy.combatTuning.charger = DEFAULT_CHARGER_COMBAT;
    enemy.nav = { ...createEnemyNav(), targetKind: "player" };
    enemy.behaviorExtra.chargeCooldownMs = 0;
    chargerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: DEFAULT_CHARGER_COMBAT.dashTriggerRange - 20,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.chargeWindupMs).toBe(
      DEFAULT_CHARGER_COMBAT.dashWindupMs,
    );
  });
});