import { describe, expect, it, vi } from "vitest";
import { testChargerCombat } from "../../test/fixtures/inlineCombat";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { spawnChargerChargeStartSmokeFx } from "../../combat/ChargerChargeSmokeFx";

vi.mock("../../combat/ChargerChargeSmokeFx", () => ({
  spawnChargerChargeStartSmokeFx: vi.fn(),
}));

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
      playerX: testChargerCombat.dashMinRangeWu - 10,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.chargeWindupMs).toBe(0);
  });

  it("starts dash windup when player is in trigger range", () => {
    vi.mocked(spawnChargerChargeStartSmokeFx).mockClear();
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
      playerX: testChargerCombat.dashTriggerRangeWu - 20,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.chargeWindupMs).toBe(
      testChargerCombat.dashWindupMs,
    );
    expect(enemy.behaviorExtra.chargeAimX).toBe(
      testChargerCombat.dashTriggerRangeWu - 20,
    );
    expect(enemy.behaviorExtra.chargeAimY).toBe(0);
    expect(spawnChargerChargeStartSmokeFx).toHaveBeenCalledWith(
      enemy.sprite.scene,
      0,
      0,
      false,
    );
  });

  it("spawns charge smoke with flipX when player is left of charger", () => {
    vi.mocked(spawnChargerChargeStartSmokeFx).mockClear();
    const enemy = mockEnemyInstance({
      behavior: "charger",
      sprite: {
        x: 100,
        y: 50,
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
      playerX: 20,
      playerY: 50,
      deltaMs: 16,
    });
    expect(spawnChargerChargeStartSmokeFx).toHaveBeenCalledWith(
      enemy.sprite.scene,
      100,
      50,
      true,
    );
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

  it("dashes east when windup ends on top of the aim point", () => {
    const enemy = mockEnemyInstance({
      behavior: "charger",
      sprite: {
        x: 5,
        y: 7,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as never,
    });
    enemy.combatTuning.charger = testChargerCombat;
    enemy.nav = { ...createEnemyNav(), targetKind: "player" };
    enemy.behaviorExtra.chargeWindupMs = 8;
    enemy.behaviorExtra.chargeAimX = 5;
    enemy.behaviorExtra.chargeAimY = 7;
    chargerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 5,
      playerY: 7,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.chargeDashDirX).toBe(1);
    expect(enemy.behaviorExtra.chargeDashDirY).toBe(0);
    expect(enemy.behaviorExtra.chargeActiveMs).toBe(
      testChargerCombat.dashDurationMs,
    );
  });

  it("uses the default dash speed when the tune omits it, and ticks cooldown", () => {
    const enemy = mockEnemyInstance({
      behavior: "charger",
      speedWu: 80,
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as never,
    });
    const { dashSpeedMul: _omit, ...rest } = testChargerCombat;
    void _omit;
    enemy.combatTuning.charger = rest as typeof testChargerCombat;
    enemy.nav = { ...createEnemyNav(), targetKind: "player" };
    enemy.behaviorExtra.chargeActiveMs = 40;
    enemy.behaviorExtra.chargeDashDirX = 1;
    enemy.behaviorExtra.chargeDashDirY = 0;
    chargerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 80,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();

    enemy.behaviorExtra.chargeActiveMs = 0;
    enemy.behaviorExtra.chargeWindupMs = 0;
    enemy.behaviorExtra.chargeCooldownMs = 50;
    chargerBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 80,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.behaviorExtra.chargeCooldownMs).toBe(34);
  });
});
