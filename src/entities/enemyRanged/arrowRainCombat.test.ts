import { describe, expect, it, vi } from "vitest";
import { resolveEnemyCombat } from "../../core/enemyTuning";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";
import { mockEnemyInstance } from "../testEnemyInstance";
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
