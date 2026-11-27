import { describe, expect, it, vi } from "vitest";
import { northWallAttackY } from "../config/defense";
import {
  enemyMeleeContactCenterDist,
  resolveEnemyCombat,
} from "../core/enemyTuning";
import { playerBodyRadiusPx } from "./entityPhysics";
import { createEnemyNav } from "../ai/brainShared";
import {
  createEnemyCombat,
  enemyShouldDrawMeleeArcOverlay,
  enemyUsesMeleePlayerActivationRange,
  updateEnemyCombat,
  enemyIsAttacking,
  type EnemyCombatState,
} from "./EnemyCombat";
import { createRangedHybridCombatState } from "./EnemyRangedCombat";
import { shippedEnemyCombat } from "../test/shippedEnemyCombat";
import { mockEnemyInstance } from "../test/testEnemyInstance";

function mockEnemy(
  x: number,
  y: number,
  combat?: EnemyCombatState,
  defId = "grunt",
  behavior = "meleeChaser",
) {
  return mockEnemyInstance({
    defId,
    behavior,
    sprite: {
      x,
      y,
      setVelocity: vi.fn(),
      scene: { registry: { get: () => undefined } },
    } as unknown as import("./Enemy").EnemyInstance["sprite"],
    combat: combat ?? createEnemyCombat(),
    nav: createEnemyNav(),
  });
}

describe("updateEnemyCombat wall target", () => {
  it("does not zero velocity while idle between hit and trigger range", () => {
    const wy = northWallAttackY();
    const wall = resolveEnemyCombat(
      "meleeChaser",
      shippedEnemyCombat("grunt"),
      "grunt",
    ).wall;
    const y = wy + (wall.hitRangeWu + wall.triggerRangeWu) / 2;
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
    const px = 88;
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

describe("enemyShouldDrawMeleeArcOverlay", () => {
  it("suppresses arc on ranged active phase", () => {
    const archer = mockEnemyInstance({ behavior: "stationaryRanged" });
    archer.combat.phase = "active";
    expect(enemyShouldDrawMeleeArcOverlay(archer)).toBe(false);
  });

  it("shows arc for melee chaser active phase", () => {
    const grunt = mockEnemyInstance({ behavior: "meleeChaser" });
    grunt.combat.phase = "active";
    expect(enemyShouldDrawMeleeArcOverlay(grunt)).toBe(true);
  });

  it("hybrid only arcs in melee mode", () => {
    const reaver = mockEnemyInstance({
      behavior: "rangedHybrid",
      rangedHybrid: createRangedHybridCombatState(),
    });
    reaver.combat.phase = "active";
    reaver.rangedHybrid!.mode = "ranged";
    expect(enemyShouldDrawMeleeArcOverlay(reaver)).toBe(false);
    reaver.rangedHybrid!.mode = "melee";
    expect(enemyShouldDrawMeleeArcOverlay(reaver)).toBe(true);
  });
});

describe("updateEnemyCombat phases", () => {
  it("throws when the enemy has no melee combat table", () => {
    const enemy = mockEnemy(0, 0);
    delete (enemy.combatTuning as { melee?: unknown }).melee;
    expect(() =>
      updateEnemyCombat(
        enemy,
        {
          kind: "player",
          x: 0,
          y: 0,
          radius: 12,
          damageable: {
            id: "p",
            hp: 10,
            maxHp: 10,
            alive: true,
            team: "player" as const,
          },
        },
        16,
      ),
    ).toThrow(/combat.melee/);
  });

  it("steps windup, active, and recovery then returns to idle", () => {
    const enemy = mockEnemy(0, 0);
    const melee = enemy.combatTuning.melee!;
    const target = {
      kind: "player" as const,
      x: 8,
      y: 0,
      radius: 12,
      damageable: {
        id: "p",
        hp: 10,
        maxHp: 10,
        alive: true,
        team: "player" as const,
      },
    };
    expect(updateEnemyCombat(enemy, target, 16)).toBe(false);
    expect(enemy.combat.phase).toBe("windup");
    expect(enemyIsAttacking(enemy.combat)).toBe(true);
    updateEnemyCombat(enemy, target, melee.windupMs);
    expect(enemy.combat.phase).toBe("active");
    updateEnemyCombat(enemy, target, melee.activeMs);
    expect(enemy.combat.phase).toBe("recovery");
    updateEnemyCombat(enemy, target, melee.recoveryMs);
    expect(enemy.combat.phase).toBe("idle");
    expect(enemy.combat.cooldownMs).toBe(melee.cooldownMs);
  });

  it("arcs a charger only between dashes", () => {
    const charger = mockEnemy(0, 0, undefined, "charger", "charger");
    charger.combat.phase = "active";
    charger.behaviorExtra.chargeActiveMs = 0;
    charger.behaviorExtra.chargeWindupMs = 0;
    expect(enemyShouldDrawMeleeArcOverlay(charger)).toBe(true);
    charger.behaviorExtra.chargeActiveMs = 80;
    expect(enemyShouldDrawMeleeArcOverlay(charger)).toBe(false);
    charger.combat.phase = "idle";
    expect(enemyShouldDrawMeleeArcOverlay(charger)).toBe(false);
  });
});

describe("updateEnemyCombat wall leftover branches", () => {
  it("starts a wall attack from idle inside trigger range", () => {
    const wy = northWallAttackY();
    const wall = resolveEnemyCombat(
      "meleeChaser",
      shippedEnemyCombat("grunt"),
      "grunt",
    ).wall;
    const enemy = mockEnemy(0, wy + wall.triggerRangeWu * 0.25);
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 0;
    updateEnemyCombat(enemy, { kind: "wall", x: 0, y: wy }, 16);
    expect(enemy.combat.phase).toBe("windup");
  });

  it("holds position while attacking inside wall trigger range", () => {
    const wy = northWallAttackY();
    const wall = resolveEnemyCombat(
      "meleeChaser",
      shippedEnemyCombat("grunt"),
      "grunt",
    ).wall;
    const enemy = mockEnemy(0, wy + wall.triggerRangeWu * 0.25);
    enemy.combat.phase = "windup";
    enemy.combat.phaseMs = 0;
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    updateEnemyCombat(enemy, { kind: "wall", x: 0, y: wy }, 16);
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });
});
