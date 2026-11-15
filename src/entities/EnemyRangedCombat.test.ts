import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ARROW_RAIN_COMBAT,
  DEFAULT_JAVELINEER_COMBAT,
} from "../core/enemyTuning";
import { northWallAttackY } from "../config/defense";
import { createEnemyNav } from "../ai/EnemyBrain";
import {
  createArrowRainCombatState,
  createJavelineerCombatState,
  updateArrowRainCombat,
  updateJavelineerCombat,
} from "./EnemyRangedCombat";
import { mockEnemyInstance } from "./testEnemyInstance";

function baseEnemy(behavior: "arrowRainArcher" | "javelineer") {
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
    const playerDist = DEFAULT_ARROW_RAIN_COMBAT.preferredRange - 40;
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
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
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
      DEFAULT_ARROW_RAIN_COMBAT.tickIntervalMs + 10,
    );
    expect(result.hitPlayer).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
  });
});

describe("updateArrowRainCombat wall target", () => {
  it("calls onWallHit once per volley during active phase", () => {
    const wy = northWallAttackY();
    const enemy = baseEnemy("arrowRainArcher");
    enemy.sprite.y = wy + DEFAULT_ARROW_RAIN_COMBAT.preferredRange;
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.cooldownMs = 0;
    enemy.combat.hitThisSwing = false;
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
      (DEFAULT_JAVELINEER_COMBAT.minRange + DEFAULT_JAVELINEER_COMBAT.maxRange) /
      2;
    enemy.sprite.y = wy + band;
    enemy.javelineer = createJavelineerCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.cooldownMs = 0;
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
    enemy.javelineer = createJavelineerCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    const mid =
      (DEFAULT_JAVELINEER_COMBAT.minRange + DEFAULT_JAVELINEER_COMBAT.maxRange) /
      2;
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
});