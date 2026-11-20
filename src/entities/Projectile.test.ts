import { describe, expect, it, vi } from "vitest";
import { segmentFirstCircleHitT } from "../combat/Hitbox";
import type { Damageable } from "../combat/DamageSystem";
import { applyDamage } from "../combat/DamageSystem";
import { updateProjectile, type PlayerProjectile } from "./Projectile";

describe("segmentFirstCircleHitT", () => {
  it("detects hits along a moving segment", () => {
    const t = segmentFirstCircleHitT(0, 0, 40, 0, 20, 0, 8);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThan(0);
    expect(t!).toBeLessThan(1);
  });

  it("returns null when the segment misses", () => {
    expect(segmentFirstCircleHitT(0, 0, 40, 0, 20, 40, 4)).toBeNull();
  });
});

describe("updateProjectile", () => {
  it("stops on first enemy hit along the path", () => {
    const destroyed = vi.fn();
    const damageable: Damageable = {
      id: "e1",
      hp: 10,
      maxHp: 10,
      alive: true,
      team: "enemy",
    };
    const enemySprite = { x: 30, y: 0 } as unknown as Phaser.Physics.Arcade.Sprite;
    const projectile: PlayerProjectile = {
      id: "p0",
      sprite: {
        active: true,
        x: 32,
        y: 0,
        texture: { key: "fx_stone_throw" },
        destroy: destroyed,
        setRotation: vi.fn(),
        body: { velocity: { x: 400, y: 0 } },
      } as unknown as Phaser.Physics.Arcade.Sprite,
      damage: 5,
      damageFlavor: "default",
      maxTravel: 200,
      traveled: 0,
      prevX: 0,
      prevY: 0,
    };

    const hit = updateProjectile(
      projectile,
      16,
      [
        {
          id: "e1",
          x: 30,
          y: 0,
          radius: 12,
          damageable,
          sprite: enemySprite,
          enemy: {
            sprite: enemySprite,
            knockbackVx: 0,
            knockbackVy: 0,
            weight: 100,
          },
        },
      ],
      50,
    );

    expect(hit.alive).toBe(false);
    expect(hit.hitEnemyId).toBe("e1");
    expect(destroyed).toHaveBeenCalled();
    expect(damageable.hp).toBe(5);
  });

  it("does not apply direct knockback when detonating AoE on hit", () => {
    const destroyed = vi.fn();
    const damageable: Damageable = {
      id: "e1",
      hp: 10,
      maxHp: 10,
      alive: true,
      team: "enemy",
    };
    const enemyKnock = { knockbackVx: 0, knockbackVy: 0, weight: 100 };
    const enemySprite = { x: 30, y: 0 } as unknown as Phaser.Physics.Arcade.Sprite;
    const projectile: PlayerProjectile = {
      id: "p0",
      spellBehavior: "aoe_on_hit",
      blastRadiusWu: 48,
      sprite: {
        active: true,
        x: 32,
        y: 0,
        texture: { key: "fx_stone_throw" },
        destroy: destroyed,
        setRotation: vi.fn(),
        body: { velocity: { x: 400, y: 0 } },
      } as unknown as Phaser.Physics.Arcade.Sprite,
      damage: 5,
      damageFlavor: "default",
      maxTravel: 200,
      traveled: 0,
      prevX: 0,
      prevY: 0,
    };

    const hit = updateProjectile(
      projectile,
      16,
      [
        {
          id: "e1",
          x: 30,
          y: 0,
          radius: 12,
          damageable,
          sprite: enemySprite,
          enemy: { sprite: enemySprite, ...enemyKnock },
        },
      ],
      140,
    );

    expect(hit.alive).toBe(false);
    expect(enemyKnock.knockbackVx).toBe(0);
    expect(enemyKnock.knockbackVy).toBe(0);
    expect(projectile.pendingDetonation).toBeDefined();
  });

  it("applies fire flavor through applyDamage", () => {
    const onDamaged = vi.fn();
    const damageable: Damageable = {
      id: "e1",
      hp: 10,
      maxHp: 10,
      alive: true,
      team: "enemy",
      onDamaged,
    };
    applyDamage(damageable, 3, "fire");
    expect(onDamaged).toHaveBeenCalledWith(3, "fire");
  });
});