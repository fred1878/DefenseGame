import { describe, expect, it, vi } from "vitest";
import {
  BRUISER_MELEE_TUNING,
  GRUNT_MELEE_TUNING,
} from "../config/enemy";
import { northWallAttackY } from "../config/defense";
import type { EnemyInstance } from "./Enemy";
import { createEnemyNav } from "../ai/EnemyBrain";
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
    defId: "grunt",
    behavior: "meleeChaser",
    speed: 85,
    damage: 8,
    textureKey: "enemy_grunt",
    sprite: { x, y, setVelocity: vi.fn() } as unknown as EnemyInstance["sprite"],
    damageable: {
      id: "e",
      hp: 10,
      maxHp: 10,
      alive: true,
      team: "enemy",
    },
    combat: combat ?? createEnemyCombat(),
    nav: createEnemyNav(),
    behaviorExtra: { strafeSign: 1 as const, strafeFlipMs: 0 },
  };
}

describe("updateEnemyCombat wall target", () => {
  it("damages wall when in wall attack range during active phase", () => {
    const wy = northWallAttackY();
    const enemy = mockEnemy(0, wy + 20);
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.hitThisSwing = false;
    const onWallHit = vi.fn();
    const hitPlayer = updateEnemyCombat(
      enemy,
      { kind: "wall", x: 0, y: wy },
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

  it("bruiser connects farther than grunt at the same player offset", () => {
    const px = 42;
    const target = {
      kind: "player" as const,
      x: px,
      y: 0,
      radius: 14,
      damageable: {
        id: "p",
        hp: 50,
        maxHp: 50,
        alive: true,
        team: "player" as const,
      },
    };
    const grunt = mockEnemy(0, 0);
    grunt.combat.phase = "active";
    grunt.combat.phaseMs = 0;
    grunt.combat.hitThisSwing = false;
    expect(
      updateEnemyCombat(grunt, target, 0, undefined, GRUNT_MELEE_TUNING),
    ).toBe(false);

    const bruiser = mockEnemy(0, 0);
    bruiser.defId = "bruiser";
    bruiser.combat.phase = "active";
    bruiser.combat.phaseMs = 0;
    bruiser.combat.hitThisSwing = false;
    expect(
      updateEnemyCombat(bruiser, target, 0, undefined, BRUISER_MELEE_TUNING),
    ).toBe(true);
  });
});