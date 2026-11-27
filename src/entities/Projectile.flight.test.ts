import { describe, expect, it } from "vitest";
import type { Damageable } from "../combat/rules/DamageSystem";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../content/assets";
import {
  asScene,
  fakeGameObject,
  fakeScene,
  type FakeScene,
} from "../test/fakeScene";
import { mockEnemyInstance } from "../test/testEnemyInstance";
import {
  projectileArcadeRadiusPx,
  spawnEnemyLobProjectile,
  spawnEnemyProjectile,
  spawnPlayerProjectile,
  updateEnemyProjectile,
  updateProjectile,
  updateSpellProjectile,
  type PlayerProjectile,
} from "./Projectile";

type Sprite = ReturnType<typeof fakeGameObject>;

function spawn(
  scene: FakeScene,
  angle = 0,
  speed = 100,
  texture = "fx_stone_throw",
) {
  const p = spawnPlayerProjectile(
    asScene(scene),
    0,
    0,
    angle,
    speed,
    10,
    100,
    "p",
    texture,
    "physical",
  );
  (p.sprite as unknown as Sprite).scene = scene;
  return p;
}

function moveTo(p: PlayerProjectile, x: number, y: number) {
  const s = p.sprite as unknown as Sprite;
  s.x = x;
  s.y = y;
}

function enemyAt(id: string, x: number, y: number) {
  const enemy = mockEnemyInstance({
    behavior: "meleeChaser",
    id,
    sprite: { x, y } as never,
  });
  const damageable: Damageable = {
    id,
    hp: 50,
    maxHp: 50,
    alive: true,
    team: "enemy",
  };
  return { id, x, y, radius: 8, damageable, sprite: enemy.sprite, enemy };
}

describe("spawnPlayerProjectile", () => {
  it("creates a physics sprite moving along the angle, sized by texture family", () => {
    const scene = fakeScene();
    const stone = spawn(scene, Math.PI, 200);
    const s = scene.made("physics.sprite")[0]!;
    expect(s.last("setDisplaySize")).toEqual([
      SPRITE_DISPLAY.stoneThrow,
      SPRITE_DISPLAY.stoneThrow,
    ]);
    expect(s.last("setCircle")).toEqual([
      projectileArcadeRadiusPx(asScene(scene).registry),
    ]);
    expect(s.last("setVelocity")![0]).toBeCloseTo(-200);
    expect(stone).toMatchObject({
      traveled: 0,
      prevX: 0,
      prevY: 0,
      spellBehavior: "default",
    });

    spawn(scene, 0, 1, COMBAT_FX_TEXTURE.spellFireBolt);
    const bolt = scene.made("physics.sprite")[1]!;
    expect(bolt.last("setDisplaySize")).toEqual([
      SPRITE_DISPLAY.fireBolt,
      SPRITE_DISPLAY.fireBolt,
    ]);
    // MobileRPG bolt art faces upper-right -> +45deg offset.
    expect(bolt.last("setRotation")![0]).toBeCloseTo(Math.PI / 4);
  });

  it("enemy shots aim at the target; lobs become ground AoE with a committed landing", () => {
    const scene = fakeScene();
    const shot = spawnEnemyProjectile(
      asScene(scene),
      0,
      0,
      0,
      50,
      100,
      5,
      300,
      "e1",
    );
    expect(
      (shot.sprite.body as unknown as { velocity: { y: number } }).velocity.y,
    ).toBeCloseTo(100);
    expect(shot.damageFlavor).toBe("physical");

    const lob = spawnEnemyLobProjectile(
      asScene(scene),
      0,
      0,
      30,
      40,
      100,
      5,
      25,
      "lob",
    );
    expect(lob.spellBehavior).toBe("aoe_on_hit");
    expect(lob.blastRadiusWu).toBe(25);
    expect([lob.lobAimX, lob.lobAimY]).toEqual([30, 40]);
    expect(lob.maxTravel).toBe(80); // max(50 + 12, 80)
    const far = spawnEnemyLobProjectile(
      asScene(scene),
      0,
      0,
      300,
      0,
      100,
      5,
      25,
      "lob2",
    );
    expect(far.maxTravel).toBe(312);
  });
});

describe("updateProjectile", () => {
  it("returns dead for an inactive sprite", () => {
    const p = spawn(fakeScene());
    (p.sprite as unknown as Sprite).active = false;
    expect(updateProjectile(p, 16, [], 0)).toEqual({ alive: false });
  });

  it("travels until max range, then despawns into the pool", () => {
    const p = spawn(fakeScene(), 0, 1000);
    moveTo(p, 16, 0);
    expect(updateProjectile(p, 16, [], 0).alive).toBe(true);
    expect(p.traveled).toBeCloseTo(16);
    expect(p.prevX).toBe(16);
    moveTo(p, 200, 0);
    expect(updateProjectile(p, 100, [], 0).alive).toBe(false);
    expect((p.sprite as unknown as Sprite).visible).toBe(false);
  });

  it("aoe projectiles that run out of range leave a detonation", () => {
    const p = spawn(fakeScene(), 0, 1000);
    p.spellBehavior = "aoe_on_hit";
    p.blastRadiusWu = 30;
    moveTo(p, 120, 0);
    const res = updateSpellProjectile(p, {
      deltaMs: 200,
      enemies: [],
      knockbackFor: () => 0,
      findEnemy: () => undefined,
    });
    expect(res.alive).toBe(false);
    expect(res.detonation).toMatchObject({
      x: 120,
      y: 0,
      radiusWu: 30,
      damage: 10,
    });
  });

  it("hits the first enemy along the path and knocks it back", () => {
    const p = spawn(fakeScene());
    const near = enemyAt("near", 20, 0);
    const far = enemyAt("far", 40, 0);
    moveTo(p, 15, 0);
    const res = updateProjectile(p, 16, [far, near], 100);
    expect(res).toEqual({ alive: false, hitEnemyId: "near" });
    expect(near.damageable.hp).toBe(40);
    expect(far.damageable.hp).toBe(50);
    expect(near.enemy.knockbackVx).toBeGreaterThan(0);
  });

  it("knocks back from the impact point even when the step overshoots the enemy", () => {
    // Regression: knockback used to be applied from the post-step position,
    // which for a fast shot lies past the enemy and pulled it toward the shooter.
    const p = spawn(fakeScene());
    const e = enemyAt("e", 20, 0);
    moveTo(p, 60, 0);
    expect(updateProjectile(p, 16, [e], 100).hitEnemyId).toBe("e");
    expect(e.enemy.knockbackVx).toBeGreaterThan(0);
    expect(e.enemy.knockbackVy).toBeCloseTo(0);
  });

  it("pierce passes through, never double-hitting, and stops when pierce runs out", () => {
    const p = spawn(fakeScene());
    p.spellBehavior = "pierce";
    p.pierceRemaining = 1;
    const a = enemyAt("a", 20, 0);
    const b = enemyAt("b", 60, 0);
    moveTo(p, 30, 0);
    expect(updateProjectile(p, 16, [a, b], 0)).toEqual({
      alive: true,
      hitEnemyId: "a",
    });
    expect(p.pierceRemaining).toBe(0);
    moveTo(p, 70, 0);
    // a is skipped now; b is hit but pierce is spent.
    expect(updateProjectile(p, 16, [a, b], 0)).toEqual({
      alive: false,
      hitEnemyId: "b",
    });
    expect(a.damageable.hp).toBe(40);
    expect(b.damageable.hp).toBe(40);
  });

  it("unlimited pierce keeps flying", () => {
    const p = spawn(fakeScene());
    p.spellBehavior = "pierce";
    moveTo(p, 30, 0);
    expect(updateProjectile(p, 16, [enemyAt("a", 20, 0)], 0).alive).toBe(true);
  });

  it("aoe on hit detonates at the projectile without direct knockback", () => {
    const p = spawn(fakeScene());
    p.spellBehavior = "aoe_on_hit";
    p.blastRadiusWu = 40;
    const e = enemyAt("e", 20, 0);
    moveTo(p, 25, 0);
    const res = updateSpellProjectile(p, {
      deltaMs: 16,
      enemies: [e],
      knockbackFor: () => 500,
      findEnemy: () => undefined,
    });
    expect(res).toMatchObject({
      alive: false,
      hitEnemyId: "e",
      detonation: { x: 25, radiusWu: 40 },
    });
    expect(e.enemy.knockbackVx).toBe(0);
  });

  it("tracking projectiles steer toward their living target", () => {
    const p = spawn(fakeScene(), 0, 300);
    p.spellBehavior = "tracking";
    p.trackEnemyId = "t";
    const t = enemyAt("t", 0, 500);
    moveTo(p, 0, 0);
    updateSpellProjectile(p, {
      deltaMs: 16,
      enemies: [],
      knockbackFor: () => 0,
      findEnemy: () => t,
    });
    const v = (
      p.sprite.body as unknown as { velocity: { x: number; y: number } }
    ).velocity;
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(300);
  });
});

describe("updateEnemyProjectile", () => {
  function player(x: number) {
    const sprite = fakeGameObject("physics.sprite", [x, 0]);
    const damageable: Damageable = {
      id: "player",
      hp: 100,
      maxHp: 100,
      alive: true,
      team: "player",
    };
    return { x, y: 0, radius: 10, damageable, sprite: sprite as never };
  }

  it("damages (with the incoming multiplier) and knocks back the player on contact", () => {
    const p = spawn(fakeScene());
    const pl = player(30);
    moveTo(p, 25, 0);
    expect(updateEnemyProjectile(p, 16, pl, 100, 1.5)).toBe(false);
    expect(pl.damageable.hp).toBe(85);
    expect((pl.sprite as Sprite).body).toMatchObject({
      velocity: { x: expect.any(Number) },
    });
    expect(
      ((pl.sprite as Sprite).body as { velocity: { x: number } }).velocity.x,
    ).toBeGreaterThan(0);
  });

  it("knocks the player back from the impact point when the step overshoots", () => {
    const p = spawn(fakeScene());
    const pl = player(30);
    moveTo(p, 80, 0);
    expect(updateEnemyProjectile(p, 16, pl, 100)).toBe(false);
    expect(
      ((pl.sprite as Sprite).body as { velocity: { x: number } }).velocity.x,
    ).toBeGreaterThan(0);
  });

  it("lobs detonate instead of hitting directly", () => {
    const p = spawn(fakeScene());
    p.spellBehavior = "aoe_on_hit";
    p.blastRadiusWu = 20;
    const pl = player(30);
    moveTo(p, 40, 0);
    expect(updateEnemyProjectile(p, 16, pl, 100)).toBe(false);
    expect(pl.damageable.hp).toBe(100);
    expect(p.pendingDetonation).toMatchObject({ x: 40, radiusWu: 20 });
  });

  it("misses keep flying until max travel, where lobs detonate", () => {
    const p = spawn(fakeScene(), 0, 1000);
    p.spellBehavior = "aoe_on_hit";
    p.blastRadiusWu = 20;
    const pl = player(500);
    moveTo(p, 10, 0);
    expect(updateEnemyProjectile(p, 10, pl, 0)).toBe(true);
    moveTo(p, 90, 0);
    expect(updateEnemyProjectile(p, 100, pl, 0)).toBe(false);
    expect(p.pendingDetonation).toMatchObject({ x: 90 });
    (p.sprite as unknown as Sprite).active = false;
    expect(updateEnemyProjectile(p, 16, pl, 0)).toBe(false);
  });
});

describe("projectile leftover branches", () => {
  it("skips a dead enemy and prefers the first of two overlapping hits", () => {
    const p = spawn(fakeScene());
    const dead = enemyAt("dead", 20, 0);
    dead.damageable.alive = false;
    const near = enemyAt("near", 20, 0);
    const far = enemyAt("far", 40, 0);
    moveTo(p, 15, 0);
    const res = updateProjectile(p, 16, [dead, near, far], 0);
    expect(res.hitEnemyId).toBe("near");
    expect(dead.damageable.hp).toBe(50);
    expect(far.damageable.hp).toBe(50);
  });

  it("does not re-damage an enemy already recorded on the projectile", () => {
    const p = spawn(fakeScene());
    p.spellBehavior = "pierce";
    const e = enemyAt("e", 20, 0);
    p.damagedEnemyIds = new Set(["e"]);
    moveTo(p, 25, 0);
    const res = updateProjectile(p, 16, [e], 100);
    expect(res.alive).toBe(true);
    expect(res.hitEnemyId).toBeUndefined();
    expect(e.damageable.hp).toBe(50);
    expect(e.enemy.knockbackVx).toBe(0);
  });

  it("does not steer a tracking shot whose target is dead or missing", () => {
    const p = spawn(fakeScene(), 0, 0);
    p.spellBehavior = "tracking";
    p.trackEnemyId = "t";
    const body = p.sprite.body as unknown as {
      velocity: { x: number; y: number };
    };
    body.velocity.x = 0;
    body.velocity.y = 0;
    const dead = enemyAt("t", 0, 80);
    dead.damageable.alive = false;
    updateSpellProjectile(p, {
      deltaMs: 16,
      enemies: [],
      knockbackFor: () => 0,
      findEnemy: () => dead,
    });
    expect(body.velocity).toMatchObject({ x: 0, y: 0 });
    updateSpellProjectile(p, {
      deltaMs: 16,
      enemies: [],
      knockbackFor: () => 0,
      findEnemy: () => undefined,
    });
    expect(body.velocity).toMatchObject({ x: 0, y: 0 });
  });

  it("despawns a regular enemy shot at max travel without detonating", () => {
    const p = spawn(fakeScene(), 0, 1000);
    const pl = {
      x: 500,
      y: 0,
      radius: 10,
      damageable: {
        id: "player",
        hp: 100,
        maxHp: 100,
        alive: true,
        team: "player" as const,
      },
      sprite: fakeGameObject("physics.sprite", [500, 0]) as never,
    };
    moveTo(p, 200, 0);
    expect(updateEnemyProjectile(p, 200, pl, 0)).toBe(false);
    expect(p.pendingDetonation).toBeUndefined();
  });
});
