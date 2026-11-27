import { describe, expect, it, vi } from "vitest";
import {
  testArrowRainCombat,
  testJavelineerCombat,
  testStationaryRangedCombat,
} from "../test/fixtures/inlineCombat";
import { northWallAttackY } from "../config/defense";
import { createEnemyNav } from "../ai/EnemyBrain";
import {
  createArrowRainCombatState,
  createJavelineerCombatState,
  updateArrowRainCombat,
  updateJavelineerCombat,
  createStationaryRangedCombatState,
  updateStationaryRangedCombat,
} from "./EnemyRangedCombat";
import { mockEnemyInstance } from "../test/testEnemyInstance";

function baseEnemy(
  behavior: "arrowRainArcher" | "javelineer" | "stationaryRanged",
) {
  return mockEnemyInstance({
    behavior,
    damage: 10,
    nav: { ...createEnemyNav(), targetKind: "player" },
  });
}

describe("updateArrowRainCombat", () => {
  it("does not start a volley when player is inside preferred range", () => {
    const enemy = baseEnemy("arrowRainArcher");
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 0;
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    const playerDist = testArrowRainCombat.preferredRangeWu - 40;
    updateArrowRainCombat(
      enemy,
      {
        kind: "player",
        x: playerDist,
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
      enemy.arrowRain,
      16,
    );
    expect(enemy.combat.phase).toBe("idle");
  });

  it("deals tick damage when player stays in telegraphed zone", () => {
    const enemy = baseEnemy("arrowRainArcher");
    enemy.combatTuning.arrowRain = testArrowRainCombat;
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.attackTargetKind = "player";
    enemy.arrowRain.zoneX = 40;
    enemy.arrowRain.zoneY = 0;
    const target = {
      kind: "player" as const,
      x: 40,
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
    enemy.arrowRain.zoneX = 40;
    enemy.arrowRain.zoneY = 0;
    const result = updateArrowRainCombat(
      enemy,
      target,
      enemy.arrowRain,
      testArrowRainCombat.tickIntervalMs + 10,
    );
    expect(result.hitPlayer).toBe(true);
    expect(result.damage).toBe(
      testArrowRainCombat.damage * testArrowRainCombat.tickDamageScale,
    );
  });
});

describe("updateArrowRainCombat wall target", () => {
  it("calls onWallHit once per volley during active phase", () => {
    const wy = northWallAttackY();
    const enemy = baseEnemy("arrowRainArcher");
    enemy.sprite.y = wy + testArrowRainCombat.preferredRangeWu;
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.cooldownMs = 0;
    enemy.combat.hitThisSwing = false;
    enemy.combat.attackTargetKind = "wall";
    const onWallHit = vi.fn();
    const target = { kind: "wall" as const, x: enemy.sprite.x, y: wy };
    updateArrowRainCombat(enemy, target, enemy.arrowRain, 16, onWallHit);
    updateArrowRainCombat(enemy, target, enemy.arrowRain, 16, onWallHit);
    expect(onWallHit).toHaveBeenCalledTimes(1);
  });
});

describe("updateJavelineerCombat wall target", () => {
  it("throws at the wall and damages once per shot", () => {
    const wy = northWallAttackY();
    const enemy = baseEnemy("javelineer");
    const band =
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
    enemy.sprite.y = wy + band;
    enemy.javelineer = createJavelineerCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.cooldownMs = 0;
    enemy.combat.attackTargetKind = "wall";
    enemy.combat.commitAimX = enemy.sprite.x;
    enemy.combat.commitAimY = wy;
    const onWallHit = vi.fn();
    const result = updateJavelineerCombat(
      enemy,
      { kind: "wall", x: enemy.sprite.x, y: wy },
      enemy.javelineer,
      0,
      onWallHit,
    );
    expect(onWallHit).toHaveBeenCalledTimes(1);
    expect(result.spawnJavelin?.toY).toBe(wy);
  });
});

describe("updateJavelineerCombat", () => {
  it("requests a javelin during active phase in band", () => {
    const enemy = baseEnemy("javelineer");
    enemy.combatTuning.javelineer = testJavelineerCombat;
    enemy.javelineer = createJavelineerCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    const mid =
      (testJavelineerCombat.minRangeWu + testJavelineerCombat.maxRangeWu) / 2;
    enemy.combat.attackTargetKind = "player";
    enemy.combat.commitAimX = mid;
    enemy.combat.commitAimY = 0;
    const result = updateJavelineerCombat(
      enemy,
      {
        kind: "player",
        x: mid,
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
      enemy.javelineer,
      0,
    );
    expect(result.spawnJavelin).toBeDefined();
    expect(result.spawnJavelin?.damage).toBe(10);
  });

  it("uses javelineer combat damage instead of top-level melee damage", () => {
    const enemy = baseEnemy("javelineer");
    enemy.damage = 99;
    enemy.combatTuning.javelineer = { ...testJavelineerCombat, damage: 7 };
    enemy.javelineer = createJavelineerCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.attackTargetKind = "player";
    enemy.combat.commitAimX = 100;
    enemy.combat.commitAimY = 0;
    const result = updateJavelineerCombat(
      enemy,
      {
        kind: "player",
        x: 100,
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
      enemy.javelineer,
      0,
    );
    expect(result.spawnJavelin?.damage).toBe(7);
  });
});

describe("updateStationaryRangedCombat", () => {
  it("fires a straight bolt during active phase in range", () => {
    const enemy = baseEnemy("stationaryRanged");
    enemy.combatTuning.stationaryRanged = testStationaryRangedCombat;
    enemy.stationaryRanged = createStationaryRangedCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    const dist = testStationaryRangedCombat.attackTriggerRangeWu - 10;
    enemy.combat.attackTargetKind = "player";
    enemy.combat.commitAimX = dist;
    enemy.combat.commitAimY = 0;
    const result = updateStationaryRangedCombat(
      enemy,
      {
        kind: "player",
        x: dist,
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
      enemy.stationaryRanged,
      0,
    );
    expect(result.spawnBolt).toBeDefined();
    expect(result.spawnBolt?.toX).toBe(dist);
    expect(result.spawnBolt?.damage).toBe(10);
  });
});
