import { describe, expect, it, vi } from "vitest";
import { ARROW_RAIN_TUNING, ENEMY_TUNING, JAVELINEER_TUNING } from "../config";
import { northWallAttackY } from "../config/defense";
import type { EnemyInstance } from "./Enemy";
import { createEnemyNav } from "../ai/EnemyBrain";
import { createEnemyCombat } from "./EnemyCombat";
import {
  createArrowRainCombatState,
  createJavelineerCombatState,
  updateArrowRainCombat,
  updateJavelineerCombat,
} from "./EnemyRangedCombat";

function baseEnemy(behavior: string): EnemyInstance {
  return {
    id: "e",
    defId: behavior,
    behavior,
    speed: 80,
    damage: 10,
    textureKey: "enemy_grunt",
    sprite: {
      x: 0,
      y: 0,
      setVelocity: vi.fn(),
      scene: { add: { graphics: vi.fn() } },
    } as unknown as EnemyInstance["sprite"],
    damageable: {
      id: "e",
      hp: 20,
      maxHp: 20,
      alive: true,
      team: "enemy",
    },
    combat: createEnemyCombat(),
    nav: { ...createEnemyNav(), targetKind: "player" },
    behaviorExtra: { strafeSign: 1, strafeFlipMs: 0 },
  };
}

describe("updateArrowRainCombat", () => {
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
      ARROW_RAIN_TUNING.tickIntervalMs + 10,
    );
    expect(result.hitPlayer).toBe(true);
    expect(result.damage).toBeGreaterThan(0);
  });
});

describe("updateArrowRainCombat wall target", () => {
  it("calls onWallHit during active phase in wall attack range", () => {
    const wy = northWallAttackY();
    const enemy = baseEnemy("arrowRainArcher");
    enemy.sprite.y = wy + ENEMY_TUNING.wallAttackRange - 4;
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.cooldownMs = 0;
    const onWallHit = vi.fn();
    updateArrowRainCombat(
      enemy,
      { kind: "wall", x: enemy.sprite.x, y: wy },
      enemy.arrowRain,
      0,
      onWallHit,
    );
    expect(onWallHit).toHaveBeenCalled();
  });
});

describe("updateJavelineerCombat wall target", () => {
  it("calls onWallHit during active phase at the wall", () => {
    const wy = northWallAttackY();
    const enemy = baseEnemy("javelineer");
    enemy.sprite.y = wy + ENEMY_TUNING.wallAttackRange - 4;
    enemy.javelineer = createJavelineerCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    enemy.combat.cooldownMs = 0;
    const onWallHit = vi.fn();
    updateJavelineerCombat(
      enemy,
      { kind: "wall", x: enemy.sprite.x, y: wy },
      enemy.javelineer,
      0,
      onWallHit,
    );
    expect(onWallHit).toHaveBeenCalled();
  });
});

describe("updateJavelineerCombat", () => {
  it("requests a javelin during active phase in band", () => {
    const enemy = baseEnemy("javelineer");
    enemy.javelineer = createJavelineerCombatState();
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 0;
    const mid = (JAVELINEER_TUNING.minRange + JAVELINEER_TUNING.maxRange) / 2;
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