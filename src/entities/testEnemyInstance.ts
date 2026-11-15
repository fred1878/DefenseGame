import { vi } from "vitest";
import { createEnemyNav } from "../ai/EnemyBrain";
import { resolveEnemyCombat } from "../core/enemyTuning";
import type { EnemyInstance } from "./Enemy";
import { createEnemyCombat } from "./EnemyCombat";

export function mockEnemyInstance(
  partial: Partial<EnemyInstance> & Pick<EnemyInstance, "behavior">,
): EnemyInstance {
  const combatTuning =
    partial.combatTuning ??
    resolveEnemyCombat(partial.behavior, undefined);
  return {
    id: "e",
    defId: "test",
    speed: 85,
    damage: 8,
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
    nav: createEnemyNav(),
    behaviorExtra: { strafeSign: 1, strafeFlipMs: 0 },
    ...partial,
    combatTuning,
  };
}