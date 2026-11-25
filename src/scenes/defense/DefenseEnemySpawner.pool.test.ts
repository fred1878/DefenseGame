import { describe, expect, it, vi } from "vitest";
import type { DataStore, EnemyDef } from "../../core/DataStore";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";
import { spawnDefenseEnemyAt } from "./DefenseEnemySpawner";

const gruntDef: EnemyDef = {
  behavior: "meleeChaser",
  hp: 20,
  speedWu: 60,
  damage: 5,
  weight: 100,
  challengeRating: 1,
  textureKey: "enemy_grunt",
  displayName: "Grunt",
  bodyRadiusWu: 14,
  combat: shippedEnemyCombat("grunt"),
};

function mockHost() {
  const enemies: import("../../entities/Enemy").EnemyInstance[] = [];
  const enemyGroup = { add: vi.fn(), remove: vi.fn() };
  const scene = {
    registry: { get: () => undefined },
    tweens: {
      killTweensOf: vi.fn(),
      add: vi.fn((cfg: { onComplete?: () => void }) => {
        cfg.onComplete?.();
      }),
    },
    physics: {
      add: {
        sprite: vi.fn(() => {
          const sprite = {
            texture: { key: "enemy_grunt_s" },
            scene,
            displayWidth: 64,
            displayHeight: 64,
            setDisplaySize: vi.fn(),
            setCircle: vi.fn(),
            setDepth: vi.fn(),
            setInteractive: vi.fn(),
            removeAllListeners: vi.fn(),
            on: vi.fn(),
            setTexture: vi.fn(),
            setPosition: vi.fn(),
            setVelocity: vi.fn(),
            clearTint: vi.fn(),
            setAlpha: vi.fn(),
            setBounce: vi.fn(),
            setCollideWorldBounds: vi.fn(),
            setActive: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            body: {
              reset: vi.fn(),
              enable: true,
              pushable: true,
              setVelocity: vi.fn(),
              setFriction: vi.fn(),
              stop: vi.fn(),
            },
          };
          return sprite;
        }),
      },
    },
    add: {
      text: vi.fn(() => ({
        setOrigin: vi.fn().mockReturnThis(),
        setText: vi.fn(),
      })),
      graphics: vi.fn(() => ({
        clear: vi.fn(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
      })),
      container: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
      })),
    },
  } as unknown as Phaser.Scene;

  return {
    scene,
    dataStore: { enemies: { grunt: gruntDef } } as unknown as DataStore,
    enemies,
    enemyGroup: enemyGroup as unknown as Phaser.Physics.Arcade.Group,
    hooks: { onRemovedFromPlay: vi.fn(), onFocusEnemy: vi.fn() },
  };
}

describe("spawnDefenseEnemyAt pool", () => {
  it("reuses pooled enemy shells after death", () => {
    const host = mockHost();
    spawnDefenseEnemyAt(host, 0, 0, gruntDef, "grunt");
    expect(host.enemies).toHaveLength(1);
    const firstSprite = host.enemies[0]!.sprite;

    const dead = host.enemies[0]!;
    dead.damageable.alive = false;
    dead.damageable.onDeath?.();
    host.enemies.length = 0;
    expect(dead.sprite.setActive).toHaveBeenCalledWith(false);
    expect(dead.nameplate.container.setVisible).toHaveBeenCalledWith(false);

    spawnDefenseEnemyAt(host, 10, 10, gruntDef, "grunt");
    expect(host.enemies).toHaveLength(1);
    expect(host.enemies[0]!.sprite).toBe(firstSprite);
    expect(host.enemies[0]!.damageable.alive).toBe(true);
  });
});
