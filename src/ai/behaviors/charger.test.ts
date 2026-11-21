import { describe, expect, it, vi } from "vitest";
import { testChargerCombat } from "../../test/fixtures/inlineCombat";
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

  it("does not start dash when player is inside dashMinRange", () => {
    const enemy = mockEnemyInstance({
      behavior: "charger",
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    enemy.combatTuning.charger = testChargerCombat;
    enemy.nav = { ...createEnemyNav(), targetKind: "player" };
    enemy.behaviorExtra.chargeCooldownMs = 0;
    chargerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: testChargerCombat.dashMinRange - 10,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.chargeWindupMs).toBe(0);
  });

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
    enemy.combatTuning.charger = testChargerCombat;
    enemy.nav = { ...createEnemyNav(), targetKind: "player" };
    enemy.behaviorExtra.chargeCooldownMs = 0;
    chargerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: testChargerCombat.dashTriggerRange - 20,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.chargeWindupMs).toBe(
      testChargerCombat.dashWindupMs,
    );
    expect(enemy.behaviorExtra.chargeAimX).toBe(
      testChargerCombat.dashTriggerRange - 20,
    );
    expect(enemy.behaviorExtra.chargeAimY).toBe(0);
  });

  it("dashes in a fixed direction past the windup aim point", () => {
    const setVelocity = vi.fn();
    const enemy = mockEnemyInstance({
      behavior: "charger",
      sprite: {
        x: 0,
        y: 0,
        setVelocity,
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    enemy.combatTuning.charger = testChargerCombat;
    enemy.nav = { ...createEnemyNav(), targetKind: "player" };
    enemy.behaviorExtra.chargeWindupMs = 1;
    enemy.behaviorExtra.chargeAimX = 100;
    enemy.behaviorExtra.chargeAimY = 0;

    const openGrid = {
      blocked: () => false,
      width: 1,
      height: 1,
      cellSize: 40,
    } as unknown as import("../../pathfinding/grid").NavGrid;

    chargerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 200,
      playerY: 0,
      deltaMs: 1,
    });

    expect(enemy.behaviorExtra.chargeActiveMs).toBe(
      testChargerCombat.dashDurationMs,
    );
    expect(enemy.behaviorExtra.chargeAimX).toBeGreaterThan(100);
    expect(enemy.behaviorExtra.chargeDashDirX).toBeCloseTo(1);
    expect(enemy.behaviorExtra.chargeDashDirY).toBeCloseTo(0);

    setVelocity.mockClear();
    chargerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: -50,
      playerY: 80,
      deltaMs: 16,
    });

    expect(setVelocity).toHaveBeenCalled();
    const vx = setVelocity.mock.calls[0]![0];
    const vy = setVelocity.mock.calls[0]![1];
    expect(vx).toBeGreaterThan(0);
    expect(Math.abs(vy)).toBeLessThan(0.01);
  });
});