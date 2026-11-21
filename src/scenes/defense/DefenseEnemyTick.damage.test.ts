import { describe, expect, it, vi } from "vitest";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { testChargerCombat } from "../../test/fixtures/inlineCombat";
import { tickDefenseEnemies } from "./DefenseEnemyTick";

function spriteStub(x: number, y: number) {
  return {
    x,
    y,
    setVelocity: vi.fn(),
    scene: {
      registry: { get: () => undefined },
    },
  } as never;
}

function minimalTickHost(
  enemies: ReturnType<typeof mockEnemyInstance>[],
  playerHp = 100,
) {
  const playerDamageable = {
    id: "p",
    hp: playerHp,
    maxHp: playerHp,
    alive: true,
    team: "player" as const,
  };
  return {
    scene: {} as never,
    registry: { get: () => undefined } as never,
    navGrid: {} as never,
    enemies,
    enemyProjectiles: [],
    enemySpellStatus: { isStunned: () => false, isRooted: () => false } as never,
    enemyPathGoals: new Map(),
    wallHp: 100,
    playerInvulnMs: 0,
    playerHurtbox: {
      x: 0,
      y: 0,
      radius: 14,
      damageable: playerDamageable,
    },
    nextProjectileId: (p: string) => p,
  };
}

describe("tickDefenseEnemies damage paths", () => {
  it("applies chargeDamage when charger touches player during dash", () => {
    const enemy = mockEnemyInstance({
      behavior: "charger",
      defId: "charger",
      damage: 12,
      sprite: spriteStub(0, 0),
    });
    enemy.combatTuning = {
      ...enemy.combatTuning,
      charger: testChargerCombat,
    };
    enemy.behaviorExtra.chargeActiveMs = 100;
    enemy.behaviorExtra.chargeHitThisDash = false;

    const host = minimalTickHost([enemy]);
    tickDefenseEnemies(host, 16);
    expect(host.playerHurtbox.damageable.hp).toBe(100 - testChargerCombat.chargeDamage);
    expect(enemy.behaviorExtra.chargeHitThisDash).toBe(true);
  });
});