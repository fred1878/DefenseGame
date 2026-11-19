import { describe, expect, it, vi } from "vitest";
import { testWallSiegeCombat } from "../../test/fixtures/inlineCombat";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { northWallAttackY } from "../../config";
import { wallSiegeBehavior } from "./wallSiege";
import { PLAYER_AGGRO_RADIUS } from "../../config";
import { wallMeleeStandoffY } from "./movement";

describe("wallSiegeBehavior", () => {
  const openGrid = {
    blocked: () => false,
    width: 1,
    height: 1,
    cellSize: 40,
  } as unknown as import("../../pathfinding/grid").NavGrid;

  it("ignores player beyond tight siege aggro", () => {
    const enemy = mockEnemyInstance({
      behavior: "wallSiege",
      combatTuning: undefined,
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    enemy.combatTuning.wallSiege = testWallSiegeCombat;
    enemy.nav = { ...createEnemyNav(), targetKind: "wall" };
    wallSiegeBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: testWallSiegeCombat.playerAggroRadius + 40,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.nav.targetKind).toBe("wall");
  });

  it("holds still at wall during melee cooldown", () => {
    const enemy = mockEnemyInstance({
      behavior: "wallSiege",
      sprite: {
        x: 10,
        y: northWallAttackY(),
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
    });
    enemy.combatTuning.wallSiege = testWallSiegeCombat;
    enemy.sprite.y = wallMeleeStandoffY(enemy);
    enemy.combat.cooldownMs = 250;
    enemy.nav = { ...createEnemyNav(), targetKind: "wall" };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    setVelocity.mockClear();
    wallSiegeBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 400,
      playerY: 300,
      deltaMs: 16,
    });
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("paths when player is inside default aggro band", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    setVelocity.mockClear();
    expect(PLAYER_AGGRO_RADIUS).toBeGreaterThan(
      testWallSiegeCombat.playerAggroRadius,
    );
  });
});