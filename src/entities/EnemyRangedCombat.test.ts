import { describe, expect, it, vi } from "vitest";
import { ARROW_RAIN_TUNING, JAVELINEER_TUNING } from "../config";
import type { EnemyInstance } from "./Enemy";
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
    nav: { targetKind: "player", path: [], pathIndex: 0, replanMs: 0 },
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