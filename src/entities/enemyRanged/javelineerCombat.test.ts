import { describe, expect, it, vi } from "vitest";
import { resolveEnemyCombat } from "../../core/enemyTuning";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";
import { mockEnemyInstance } from "../testEnemyInstance";
import { createJavelineerCombatState } from "./types";
import { updateJavelineerCombat } from "./javelineerCombat";

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

describe("updateJavelineerCombat", () => {
  const combatTuning = resolveEnemyCombat(
    "javelineer",
    shippedEnemyCombat("javelineer"),
    "javelineer",
  );

  function makeEnemy() {
    return mockEnemyInstance({
      behavior: "javelineer",
      defId: "javelineer",
      combatTuning,
      sprite: {
        x: 0,
        y: 0,
        setVelocity: vi.fn(),
        scene: { registry: { get: () => undefined } },
      } as never,
    });
  }

  it("starts a windup when idle with the player in the throw band", () => {
    const enemy = makeEnemy();
    enemy.javelineer = createJavelineerCombatState();
    const mid =
      (combatTuning.javelineer!.minRangeWu +
        combatTuning.javelineer!.maxRangeWu) /
      2;
    const result = updateJavelineerCombat(
      enemy,
      playerTarget(mid, 0),
      enemy.javelineer,
      16,
    );
    expect(enemy.combat.phase).toBe("windup");
    expect(result.spawnJavelin).toBeUndefined();
    expect(enemy.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("fires at the wall and reports the hit once the shot goes active", () => {
    const enemy = makeEnemy();
    enemy.javelineer = createJavelineerCombatState();
    const mid =
      (combatTuning.javelineer!.minRangeWu +
        combatTuning.javelineer!.maxRangeWu) /
      2;
    const wall = {
      kind: "wall" as const,
      x: 0,
      y: -mid,
      radius: 8,
    };
    updateJavelineerCombat(enemy, wall, enemy.javelineer, 16);
    expect(enemy.combat.phase).toBe("windup");
    const onWallHit = vi.fn();
    const fired = updateJavelineerCombat(
      enemy,
      wall,
      enemy.javelineer,
      combatTuning.javelineer!.windupMs,
      onWallHit,
    );
    expect(enemy.combat.phase).toBe("active");
    expect(fired.spawnJavelin).toBeDefined();
    expect(onWallHit).toHaveBeenCalledOnce();
    const again = updateJavelineerCombat(
      enemy,
      wall,
      enemy.javelineer,
      16,
      onWallHit,
    );
    expect(again.spawnJavelin).toBeUndefined();
    expect(onWallHit).toHaveBeenCalledOnce();
  });
});
