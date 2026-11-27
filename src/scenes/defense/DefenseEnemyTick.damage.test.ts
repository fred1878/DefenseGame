import { describe, expect, it, vi } from "vitest";
import { DEFENSE_MAP } from "../../config/defense";
import type { Damageable } from "../../combat/DamageSystem";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { buildNavGrid } from "../../pathfinding/grid";
import { testChargerCombat } from "../../test/fixtures/inlineCombat";
import { tickDefenseEnemies } from "./DefenseEnemyTick";

const testNavGrid = buildNavGrid(
  [],
  DEFENSE_MAP.cellSize,
  DEFENSE_MAP.pathClearancePx,
);

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
  const playerDamageable: Damageable = {
    id: "p",
    hp: playerHp,
    maxHp: playerHp,
    alive: true,
    team: "player",
  };
  return {
    scene: {
      registry: { get: () => undefined },
    } as never,
    registry: { get: () => undefined } as never,
    navGrid: testNavGrid,
    enemies,
    enemyProjectiles: [],
    enemySpellStatus: {
      isStunned: () => false,
      isRooted: () => false,
    } as never,
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
  it("passes physical flavor when grunt melee arc hits player", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      damage: 11,
      sprite: spriteStub(0, 0),
    });
    enemy.combat.phase = "active";
    enemy.combat.phaseMs = 5;
    enemy.combat.hitThisSwing = false;
    enemy.combat.attackTargetKind = "player";
    enemy.combat.facing = 0;
    enemy.combat.slashFxShown = true;

    const onDamaged = vi.fn();
    const host = minimalTickHost([enemy]);
    host.playerHurtbox.x = 36;
    host.playerHurtbox.y = 0;
    host.playerHurtbox.damageable.onDamaged = onDamaged;

    tickDefenseEnemies(host, 16);

    expect(host.playerHurtbox.damageable.hp).toBeLessThan(100);
    expect(onDamaged).toHaveBeenCalledWith(11, "physical");
  });

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

    const onDamaged = vi.fn();
    const host = minimalTickHost([enemy]);
    host.playerHurtbox.damageable.onDamaged = onDamaged;
    tickDefenseEnemies(host, 16);
    expect(host.playerHurtbox.damageable.hp).toBe(
      100 - testChargerCombat.chargeDamage,
    );
    expect(enemy.behaviorExtra.chargeHitThisDash).toBe(true);
    expect(onDamaged).toHaveBeenCalledWith(
      testChargerCombat.chargeDamage,
      "physical",
    );
  });
});
