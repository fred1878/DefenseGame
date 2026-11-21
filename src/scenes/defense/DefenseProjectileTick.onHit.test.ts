import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { Damageable } from "../../combat/DamageSystem";
import { EnemySpellStatusMap } from "../../combat/enemySpellStatus";
import type { PlayerProjectile } from "../../entities/Projectile";
import type { Player } from "../../entities/Player";
import { tickDefenseProjectiles, type DefenseProjectileTickHost } from "./DefenseProjectileTick";

function mockHost(projectiles: PlayerProjectile[]): DefenseProjectileTickHost & {
  status: EnemySpellStatusMap;
} {
  const scene = { registry: {} } as unknown as Phaser.Scene;
  const status = new EnemySpellStatusMap();
  const damageable: Damageable = {
    id: "grunt",
    hp: 30,
    maxHp: 30,
    alive: true,
    team: "enemy",
  };
  return {
    scene,
    registry: scene.registry,
    player: { sprite: { x: 0, y: 0 } } as unknown as Player,
    playerInvulnMs: 0,
    projectiles,
    enemyProjectiles: [],
    enemyTargets: () => [
      {
        id: "grunt",
        x: 30,
        y: 0,
        radius: 12,
        damageable,
        sprite: { x: 30, y: 0 } as Phaser.Physics.Arcade.Sprite,
        enemy: {
          sprite: { x: 30, y: 0 } as Phaser.Physics.Arcade.Sprite,
          knockbackVx: 0,
          knockbackVy: 0,
          weight: 100,
        } as import("../../entities/Enemy").EnemyInstance,
      },
    ],
    spellDamageMult: () => 1,
    wu: (n: number) => n,
    findEnemy: () => undefined,
    enemySpellStatus: status,
    flashNova: vi.fn(),
    status,
  };
}

describe("tickDefenseProjectiles onHit", () => {
  it("applies knockback when a non-spell projectile hits", () => {
    const destroyed = vi.fn();
    const enemyKnock = {
      sprite: { x: 30, y: 0 } as Phaser.Physics.Arcade.Sprite,
      knockbackVx: 0,
      knockbackVy: 0,
      weight: 100,
    };
    const projectile: PlayerProjectile = {
      id: "p0",
      sprite: {
        active: true,
        x: 32,
        y: 0,
        texture: { key: "player_ranged" },
        destroy: destroyed,
        setRotation: vi.fn(),
        body: { velocity: { x: 400, y: 0 } },
      } as unknown as Phaser.Physics.Arcade.Sprite,
      damage: 12,
      damageFlavor: "default",
      maxTravel: 200,
      traveled: 0,
      prevX: 0,
      prevY: 0,
    };

    const base = mockHost([projectile]);
    const host: DefenseProjectileTickHost = {
      ...base,
      enemyTargets: () => [
        {
          ...base.enemyTargets()[0]!,
          enemy: enemyKnock as import("../../entities/Enemy").EnemyInstance,
        },
      ],
    };

    tickDefenseProjectiles(host, 16);
    expect(Math.abs(enemyKnock.knockbackVx)).toBeGreaterThan(0);
    expect(destroyed).toHaveBeenCalled();
  });

  it("applies ice_bolt slow when the projectile hits", () => {
    const destroyed = vi.fn();
    const projectile: PlayerProjectile = {
      id: "p0",
      spellId: "ice_bolt",
      sprite: {
        active: true,
        x: 32,
        y: 0,
        texture: { key: "fx_spell_ice_bolt" },
        destroy: destroyed,
        setRotation: vi.fn(),
        body: { velocity: { x: 400, y: 0 } },
      } as unknown as Phaser.Physics.Arcade.Sprite,
      damage: 12,
      damageFlavor: "default",
      maxTravel: 200,
      traveled: 0,
      prevX: 0,
      prevY: 0,
    };

    const host = mockHost([projectile]);
    tickDefenseProjectiles(host, 16);

    expect(destroyed).toHaveBeenCalled();
    expect(host.status.moveSpeedMultiplier("grunt")).toBeCloseTo(0.5);
  });
});