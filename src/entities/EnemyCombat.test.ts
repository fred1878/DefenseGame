import { describe, expect, it, vi } from "vitest";
import { northWallAttackY } from "../config/defense";
import { enemyMeleeContactCenterDist, resolveEnemyCombat } from "../core/enemyTuning";
import { playerBodyRadiusPx } from "./entityPhysics";
import { createEnemyNav } from "../ai/EnemyBrain";
import {
  createEnemyCombat,
  enemyUsesMeleePlayerActivationRange,
  updateEnemyCombat,
  type EnemyCombatState,
} from "./EnemyCombat";
import { mockEnemyInstance } from "./testEnemyInstance";

function mockEnemy(
  x: number,
  y: number,
  combat?: EnemyCombatState,
  defId = "grunt",
  behavior = "meleeChaser",
) {
  const combatPartial =
    defId === "bruiser"
      ? ({
          wall: { damage: 8, triggerRange: 52, hitRange: 44 },
          melee: {
            triggerRange: 75,
            range: 67,
            arcDeg: 78,
            windupMs: 480,
            activeMs: 130,
            recoveryMs: 600,
            cooldownMs: 520,
          },
        } as const)
      : undefined;
  return mockEnemyInstance({
    defId,
    behavior,
    combatTuning: resolveEnemyCombat(behavior, combatPartial, defId),
    sprite: { x, y, setVelocity: vi.fn() } as unknown as import("./Enemy").EnemyInstance["sprite"],
    combat: combat ?? createEnemyCombat(),
    nav: createEnemyNav(),
  });
}

describe("updateEnemyCombat wall target", () => {
  it("does not zero velocity while idle between hit and trigger range", () => {
    const wy = northWallAttackY();
    const wall = resolveEnemyCombat("meleeChaser", undefined).wall;
    const y = wy + (wall.hitRange + wall.triggerRange) / 2;
    const enemy = mockEnemy(0, y);
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 200;
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    updateEnemyCombat(enemy, { kind: "wall", x: 0, y: wy }, 16);
    expect(setVelocity).not.toHaveBeenCalled();
  });

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
  it("connects at arcade contact distance for meleeChaser", () => {
    const dist = enemyMeleeContactCenterDist("grunt");
    const enemy = mockEnemy(0, 0, undefined, "grunt", "meleeChaser");
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.hitThisSwing = false;
    const hit = updateEnemyCombat(
      enemy,
      {
        kind: "player",
        x: dist,
        y: 0,
        radius: playerBodyRadiusPx(),
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
    const px = 67;
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
    expect(updateEnemyCombat(grunt, target, 0)).toBe(false);

    const bruiser = mockEnemy(0, 0, undefined, "bruiser", "bruiser");
    bruiser.combat.phase = "active";
    bruiser.combat.phaseMs = 0;
    bruiser.combat.hitThisSwing = false;
    expect(updateEnemyCombat(bruiser, target, 0)).toBe(true);
  });
});

describe("enemyUsesMeleePlayerActivationRange", () => {
  it("includes melee chasers and hybrids", () => {
    expect(enemyUsesMeleePlayerActivationRange("meleeChaser")).toBe(true);
    expect(enemyUsesMeleePlayerActivationRange("rangedHybrid")).toBe(true);
  });

  it("excludes pure ranged behaviors", () => {
    expect(enemyUsesMeleePlayerActivationRange("arrowRainArcher")).toBe(false);
    expect(enemyUsesMeleePlayerActivationRange("stationaryRanged")).toBe(false);
  });
});