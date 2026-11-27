import { describe, expect, it, vi } from "vitest";
import { resolveEnemyCombat } from "../../core/enemyTuning";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { createArrowRainCombatState } from "./types";
import { updateArrowRainCombat } from "./arrowRainCombat";

describe("updateArrowRainCombat", () => {
  const combatTuning = resolveEnemyCombat(
    "arrowRainArcher",
    shippedEnemyCombat("arrow_rain_archer"),
    "arrow_rain_archer",
  );

  function makeEnemy() {
    const gfx = {
      destroy: vi.fn(),
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      setDepth: vi.fn(),
    };
    gfx.setDepth.mockReturnValue(gfx);
    return mockEnemyInstance({
      behavior: "arrowRainArcher",
      defId: "arrow_rain_archer",
      combatTuning,
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: {
          add: { graphics: vi.fn(() => gfx) },
          registry: { get: () => undefined },
        },
      } as never,
    });
  }

  it("ticks cooldown and starts a windup when the player is in the volley band", () => {
    const enemy = makeEnemy();
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 40;
    const mid = combatTuning.arrowRain!.preferredRangeWu;
    updateArrowRainCombat(
      enemy,
      {
        kind: "player",
        x: mid,
        y: 0,
        radius: 12,
        damageable: {
          id: "p",
          hp: 10,
          maxHp: 10,
          alive: true,
          team: "player",
        },
      },
      enemy.arrowRain,
      16,
    );
    expect(enemy.combat.cooldownMs).toBe(24);
    expect(enemy.combat.phase).toBe("idle");

    enemy.combat.cooldownMs = 0;
    updateArrowRainCombat(
      enemy,
      {
        kind: "player",
        x: mid,
        y: 0,
        radius: 12,
        damageable: {
          id: "p",
          hp: 10,
          maxHp: 10,
          alive: true,
          team: "player",
        },
      },
      enemy.arrowRain,
      16,
    );
    expect(enemy.combat.phase).toBe("windup");
    expect(enemy.arrowRain.telegraph).toBeDefined();
  });
});

describe("updateArrowRainCombat leftover branches", () => {
  const combatTuning = resolveEnemyCombat(
    "arrowRainArcher",
    shippedEnemyCombat("arrow_rain_archer"),
    "arrow_rain_archer",
  );

  function makeEnemy() {
    const gfx = {
      destroy: vi.fn(),
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      setDepth: vi.fn(),
    };
    gfx.setDepth.mockReturnValue(gfx);
    return mockEnemyInstance({
      behavior: "arrowRainArcher",
      defId: "arrow_rain_archer",
      combatTuning,
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: {
          add: { graphics: vi.fn(() => gfx) },
          registry: { get: () => undefined },
        },
      } as never,
    });
  }

  function playerTarget(x: number, y: number) {
    return {
      kind: "player" as const,
      x,
      y,
      radius: 12,
      damageable: {
        id: "p",
        hp: 10,
        maxHp: 10,
        alive: true,
        team: "player" as const,
      },
    };
  }

  it("deals no tick damage when the player has left the zone", () => {
    const enemy = makeEnemy();
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 0;
    const mid = combatTuning.arrowRain!.preferredRangeWu;
    const tune = combatTuning.arrowRain!;
    updateArrowRainCombat(enemy, playerTarget(mid, 0), enemy.arrowRain, 16);
    expect(enemy.combat.phase).toBe("windup");
    updateArrowRainCombat(
      enemy,
      playerTarget(mid, 0),
      enemy.arrowRain,
      tune.windupMs,
    );
    expect(enemy.combat.phase).toBe("active");
    const result = updateArrowRainCombat(
      enemy,
      playerTarget(mid + 10_000, 0),
      enemy.arrowRain,
      tune.tickIntervalMs,
    );
    expect(result).toEqual({ hitPlayer: false, damage: 0 });
  });

  it("skips telegraph updates when the telegraph was cleared mid-attack", () => {
    const enemy = makeEnemy();
    enemy.arrowRain = createArrowRainCombatState();
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 0;
    const mid = combatTuning.arrowRain!.preferredRangeWu;
    const tune = combatTuning.arrowRain!;
    updateArrowRainCombat(enemy, playerTarget(mid, 0), enemy.arrowRain, 16);
    enemy.arrowRain.telegraph = undefined;
    updateArrowRainCombat(
      enemy,
      playerTarget(mid, 0),
      enemy.arrowRain,
      tune.windupMs,
    );
    expect(enemy.combat.phase).toBe("active");
    updateArrowRainCombat(enemy, playerTarget(mid, 0), enemy.arrowRain, 16);
    expect(enemy.combat.phase).toBe("active");
  });
});
