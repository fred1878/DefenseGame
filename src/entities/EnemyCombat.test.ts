import { describe, expect, it, vi } from "vitest";
import { westWallAttackX } from "../config";
import type { EnemyInstance } from "./Enemy";
import {
  createEnemyCombat,
  updateEnemyCombat,
  type EnemyCombatState,
} from "./EnemyCombat";

function mockEnemy(
  x: number,
  y: number,
  combat?: EnemyCombatState,
): EnemyInstance {
  return {
    id: "e",
    sprite: { x, y, setVelocity: vi.fn() } as unknown as EnemyInstance["sprite"],
    damageable: {
      id: "e",
      hp: 10,
      maxHp: 10,
      alive: true,
      team: "enemy",
    },
    combat: combat ?? createEnemyCombat(),
    nav: { targetKind: "wall", path: [], pathIndex: 0, replanMs: 0 },
  };
}

describe("updateEnemyCombat wall target", () => {
  it("damages wall when in wall attack range during active phase", () => {
    const wx = westWallAttackX();
    const enemy = mockEnemy(wx + 20, 0);
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.hitThisSwing = false;
    const onWallHit = vi.fn();
    const hitPlayer = updateEnemyCombat(
      enemy,
      { kind: "wall", x: wx, y: 0 },
      0,
      onWallHit,
    );
    expect(hitPlayer).toBe(false);
    expect(onWallHit).toHaveBeenCalled();
    expect(enemy.combat.hitThisSwing).toBe(true);
  });
});

describe("updateEnemyCombat player target", () => {
  it("returns true when arc hits the player hurtbox", () => {
    const enemy = mockEnemy(0, 0);
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.hitThisSwing = false;
    const hit = updateEnemyCombat(
      enemy,
      {
        kind: "player",
        x: 30,
        y: 0,
        radius: 14,
        damageable: {
          id: "p",
          hp: 50,
          maxHp: 50,
          alive: true,
          team: "player",
        },
      },
      0,
    );
    expect(hit).toBe(true);
  });
});