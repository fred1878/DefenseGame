import { describe, expect, it } from "vitest";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import { enemyCollisionBodyRadius } from "../../entities/entityPhysics";
import { defenseHalfWidth } from "../../config/defense";
import { tickDefenseEnemies } from "./DefenseEnemyTick";

function spriteStub(x: number, y: number) {
  let vx = 0;
  let vy = 0;
  const stub = {
    x,
    y,
    setPosition(nx: number, ny: number) {
      stub.x = nx;
      stub.y = ny;
    },
    setVelocity(nx: number, ny: number) {
      vx = nx;
      vy = ny;
    },
    get body() {
      return { velocity: { x: vx, y: vy } };
    },
    scene: {
      registry: { get: () => undefined },
    },
  };
  return stub as unknown as import("../../entities/Enemy").EnemyInstance["sprite"];
}

function minimalTickHost(
  enemies: ReturnType<typeof mockEnemyInstance>[],
  stunnedIds: Set<string> = new Set(),
) {
  return {
    scene: {} as never,
    registry: { get: () => undefined } as never,
    navGrid: {} as never,
    enemies,
    enemyProjectiles: [],
    enemySpellStatus: {
      isStunned: (id: string) => stunnedIds.has(id),
      isRooted: () => false,
    } as never,
    enemyPathGoals: new Map(),
    wallHp: 100,
    playerInvulnMs: 0,
    playerHurtbox: {
      x: 0,
      y: 400,
      radius: 14,
      damageable: {
        id: "p",
        hp: 100,
        maxHp: 100,
        alive: true,
        team: "player" as const,
      },
    },
    nextProjectileId: (p: string) => p,
  };
}

describe("tickDefenseEnemies field bounds", () => {
  it("reclaims stunned enemies knocked past the play inset", () => {
    const halfW = defenseHalfWidth();
    const r = enemyCollisionBodyRadius("grunt");
    const enemy = mockEnemyInstance({
      defId: "grunt",
      behavior: "meleeChaser",
      sprite: spriteStub(halfW + 120, 0),
    });
    enemy.knockbackVx = 80;
    enemy.knockbackVy = 0;

    tickDefenseEnemies(minimalTickHost([enemy], new Set([enemy.id])), 16);

    expect(enemy.sprite.x).toBeLessThanOrEqual(halfW - r);
    expect(enemy.sprite.x).toBeGreaterThanOrEqual(-halfW + r);
    expect(enemy.knockbackVx).toBe(0);
    expect(enemy.knockbackVy).toBe(0);
  });

});