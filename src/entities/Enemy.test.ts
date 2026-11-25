import { describe, expect, it, vi } from "vitest";
import type { EnemyDef } from "../core/DataStore";
import { shippedEnemyCombatForBehavior } from "../test/shippedEnemyCombat";
import { asScene, fakeScene } from "../test/fakeScene";
import {
  reconfigureEnemyInstance,
  spawnEnemy,
  updateEnemySpriteFacing,
} from "./Enemy";

function sceneWithBody(): ReturnType<typeof fakeScene> {
  const scene = fakeScene();
  const physicsAdd = scene.physics.add as unknown as {
    sprite: (...args: unknown[]) => { body: unknown };
  };
  const origSprite = physicsAdd.sprite.bind(physicsAdd);
  scene.physics = {
    add: {
      sprite: ((...args: unknown[]) => {
        const sprite = origSprite(...args) as { body: unknown };
        const body = sprite.body as {
          setFriction?: unknown;
          setBounce?: unknown;
          setCollideWorldBounds?: unknown;
          setCircle?: unknown;
          reset?: unknown;
          setVelocity?: unknown;
          enable?: boolean;
          velocity: { x: number; y: number };
        };
        body.setFriction = () => body;
        body.setBounce = () => body;
        body.setCollideWorldBounds = () => body;
        body.setCircle = () => body;
        body.reset = () => undefined;
        body.setVelocity = (vx: number, vy: number) => {
          body.velocity.x = vx;
          body.velocity.y = vy;
          return body;
        };
        return sprite;
      }) as never,
    },
  };
  return scene;
}

function defFor(behavior: string, defId: string): EnemyDef {
  return {
    hp: 12,
    speedWu: 40,
    damage: 4,
    weight: 10,
    challengeRating: 1,
    behavior,
    textureKey: `enemy_${defId}`,
    displayName: defId,
    bodyRadiusWu: 12,
    combat: shippedEnemyCombatForBehavior(behavior, defId),
  };
}

describe("spawnEnemy", () => {
  it("binds behavior substate and optional tap handlers", () => {
    const scene = sceneWithBody();
    const behaviors: Array<
      [string, string, keyof import("./Enemy").EnemyInstance]
    > = [
      ["arrowRainArcher", "arrow_rain_archer", "arrowRain"],
      ["javelineer", "javelineer", "javelineer"],
      ["stationaryRanged", "sentry_archer", "stationaryRanged"],
      ["lobber", "lobber", "lobber"],
      ["rangedHybrid", "reaver", "rangedHybrid"],
    ];
    for (const [behavior, defId, key] of behaviors) {
      const onTap = vi.fn();
      const enemy = spawnEnemy(
        asScene(scene),
        `${defId}-1`,
        0,
        0,
        defFor(behavior, defId),
        defId,
        vi.fn(),
        onTap,
      );
      expect(enemy[key]).toBeDefined();
      const ev = {
        stopPropagation: vi.fn(),
      };
      enemy.sprite.emit("pointerdown", {}, 0, 0, ev);
      expect(onTap).toHaveBeenCalledOnce();
      expect(ev.stopPropagation).toHaveBeenCalled();
    }

    const melee = spawnEnemy(
      asScene(scene),
      "g1",
      4,
      5,
      defFor("meleeChaser", "grunt"),
      "grunt",
      vi.fn(),
    );
    expect(melee.arrowRain).toBeUndefined();
    melee.damageable.onDeath?.();
  });

  it("reconfigures a pooled shell, including a new death hook", () => {
    const scene = sceneWithBody();
    const enemy = spawnEnemy(
      asScene(scene),
      "old",
      0,
      0,
      defFor("meleeChaser", "grunt"),
      "grunt",
      vi.fn(),
    );
    const onDeath = vi.fn();
    reconfigureEnemyInstance(
      enemy,
      asScene(scene),
      "new",
      10,
      12,
      defFor("lobber", "lobber"),
      "lobber",
      onDeath,
    );
    expect(enemy.id).toBe("new");
    expect(enemy.behavior).toBe("lobber");
    expect(enemy.lobber).toBeDefined();
    enemy.damageable.onDeath?.();
    expect(onDeath).toHaveBeenCalledOnce();
  });
});

describe("updateEnemySpriteFacing", () => {
  it("keeps the current card when the body is missing or already facing that way", () => {
    const scene = sceneWithBody();
    const enemy = spawnEnemy(
      asScene(scene),
      "g",
      0,
      0,
      defFor("meleeChaser", "grunt"),
      "grunt",
      vi.fn(),
    );
    enemy.sprite.body = null as never;
    updateEnemySpriteFacing(enemy);
    enemy.sprite.body = { velocity: { x: 0, y: 40 } } as never;
    const first = enemy.cardinalFacing;
    updateEnemySpriteFacing(enemy);
    const after = enemy.cardinalFacing;
    updateEnemySpriteFacing(enemy);
    expect(enemy.cardinalFacing).toBe(after);
    expect(typeof first).toBe("string");
  });
});
