import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { Damageable } from "../../combat/rules/DamageSystem";
import { EnemySpellStatusMap } from "../../combat/rules/enemySpellStatus";
import type { PlayerProjectile } from "../../entities/Projectile";
import type { Player } from "../../entities/Player";
import {
  tickDefenseProjectiles,
  type DefenseProjectileTickHost,
} from "./DefenseProjectileTick";

function mockHost(
  projectiles: PlayerProjectile[],
): DefenseProjectileTickHost & {
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

function mockProjectileSprite(
  scene: Phaser.Scene,
  textureKey: string,
): {
  sprite: Phaser.Physics.Arcade.Sprite;
  setActive: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
} {
  const setActive = vi.fn().mockReturnThis();
  const setVisible = vi.fn().mockReturnThis();
  const sprite = {
    active: true,
    x: 32,
    y: 0,
    texture: { key: textureKey },
    scene,
    setActive,
    setVisible,
    setRotation: vi.fn(),
    body: {
      velocity: { x: 400, y: 0 },
      stop: vi.fn(),
      enable: true,
    },
  } as unknown as Phaser.Physics.Arcade.Sprite;
  return { sprite, setActive, setVisible };
}

describe("tickDefenseProjectiles onHit", () => {
  it("applies knockback when a non-spell projectile hits", () => {
    const enemyKnock = {
      sprite: { x: 30, y: 0 } as Phaser.Physics.Arcade.Sprite,
      knockbackVx: 0,
      knockbackVy: 0,
      weight: 100,
    };
    const base = mockHost([]);
    const { sprite, setActive, setVisible } = mockProjectileSprite(
      base.scene,
      "player_ranged",
    );
    const projectile: PlayerProjectile = {
      id: "p0",
      sprite,
      damage: 12,
      damageFlavor: "fire",
      maxTravel: 200,
      traveled: 0,
      prevX: 0,
      prevY: 0,
    };
    base.projectiles = [projectile];

    const onWeaponHit = vi.fn();
    const host: DefenseProjectileTickHost = {
      ...base,
      onWeaponHit,
      enemyTargets: () => [
        {
          ...base.enemyTargets()[0]!,
          enemy: enemyKnock as import("../../entities/Enemy").EnemyInstance,
        },
      ],
    };

    tickDefenseProjectiles(host, 16);
    expect(Math.abs(enemyKnock.knockbackVx)).toBeGreaterThan(0);
    expect(onWeaponHit).toHaveBeenCalledWith("grunt", 12);
    expect(setActive).toHaveBeenCalledWith(false);
    expect(setVisible).toHaveBeenCalledWith(false);
  });

  it("applies ice_bolt slow when the projectile hits", () => {
    const base = mockHost([]);
    const { sprite, setActive } = mockProjectileSprite(
      base.scene,
      "fx_spell_ice_bolt",
    );
    const projectile: PlayerProjectile = {
      id: "p0",
      spellId: "ice_bolt",
      sprite,
      damage: 12,
      damageFlavor: "fire",
      maxTravel: 200,
      traveled: 0,
      prevX: 0,
      prevY: 0,
    };
    base.projectiles = [projectile];
    tickDefenseProjectiles(base, 16);

    expect(setActive).toHaveBeenCalledWith(false);
    expect(base.status.moveSpeedMultiplier("grunt")).toBeCloseTo(0.3);
  });
});
