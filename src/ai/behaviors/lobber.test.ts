import { describe, expect, it, vi } from "vitest";
import { DEFENSE_MAP } from "../../config";
import { buildNavGrid } from "../../pathfinding/grid";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";
import { resolveEnemyCombat } from "../../core/enemyTuning";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { createEnemyNav } from "../EnemyBrain";
import { lobberBehavior } from "./lobber";

function mockLobber(
  x: number,
  y: number,
  combat = shippedEnemyCombat("lobber"),
) {
  const combatTuning = resolveEnemyCombat("lobber", combat, "lobber");
  return mockEnemyInstance({
    id: "l",
    defId: "lobber",
    behavior: "lobber",
    combatTuning,
    sprite: {
      x,
      y,
      setVelocity: vi.fn(),
      scene: { registry: { get: () => undefined } },
    } as never,
    nav: { ...createEnemyNav(), targetKind: "player" },
  });
}

describe("lobberBehavior", () => {
  const navGrid = buildNavGrid(
    [],
    DEFENSE_MAP.cellSize,
    DEFENSE_MAP.pathClearancePx,
  );
  const lob = shippedEnemyCombat("lobber").lobber;
  if (!lob) throw new Error("expected lobber combat tuning");
  const preferred = lob.preferredRangeWu ?? 200;
  const slack = lob.kiteBandSlackWu ?? 22;
  const attackMax = lob.attackTriggerRangeWu ?? 222;

  it("chases the goal when lobber tuning is missing", () => {
    const enemy = mockLobber(0, 0);
    const { lobber: _ignored, ...rest } = enemy.combatTuning;
    enemy.combatTuning = rest;
    enemy.nav.replanMs = 0;
    lobberBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: 80,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("stops moving while an attack is in progress", () => {
    const enemy = mockLobber(0, 0);
    enemy.combat.phase = "windup";
    lobberBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: preferred,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("retreats when the player is inside the preferred kite band", () => {
    const enemy = mockLobber(0, 0);
    enemy.nav.replanMs = 0;
    const close = preferred - slack - 20;
    lobberBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: close,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("stops in the attack band while idle", () => {
    const idle = mockLobber(0, 0);
    const inBand = preferred + 4;
    lobberBehavior({
      enemy: idle,
      nav: idle.nav,
      grid: navGrid,
      playerX: inBand,
      playerY: 0,
      deltaMs: 16,
    });
    expect(idle.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("follows the planned path when the target is beyond attack range", () => {
    const enemy = mockLobber(0, 0);
    enemy.nav.replanMs = 0;
    enemy.nav.path = [
      { x: 400, y: 0 },
      { x: 500, y: 0 },
    ];
    enemy.nav.pathIndex = 0;
    lobberBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: attackMax + 200,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });

  it("uses the wall goal when the current target is not the player", () => {
    const enemy = mockLobber(0, 0);
    enemy.nav.targetKind = "wall";
    lobberBehavior({
      enemy,
      nav: enemy.nav,
      grid: navGrid,
      playerX: 400,
      playerY: 0,
      deltaMs: 16,
    });
    expect(enemy.sprite.setVelocity).toHaveBeenCalled();
  });
});
