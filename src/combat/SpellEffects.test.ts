import { describe, expect, it, vi } from "vitest";
import { PLAYER_TUNING } from "../config";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import {
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";
import {
  ICE_FX_ANIM,
  ICE_FX_ASSETS,
  ICE_FX_TEXTURE,
} from "../content/iceFxAssets";
import type { SpellDefinition } from "../content/spells";
import { mockEnemyInstance } from "../entities/testEnemyInstance";
import { asScene, fakeScene } from "../test/fakeScene";
import type { EnemySpellStatusMap } from "./enemySpellStatus";
import {
  applyChainLightning,
  applyChanneledHeal,
  applyHealAmount,
  applyInstantTargeted,
  applyNova,
  applySpellBlastAt,
  applySpellCone,
  applySpellSwing,
  spawnChanneledFireball,
  spawnSpellProjectile,
  strikeSpellCone,
  type SpellEnemyTarget,
} from "./SpellEffects";

function def(partial: Partial<SpellDefinition>): SpellDefinition {
  return {
    id: "test_spell",
    name: "Test",
    shortLabel: "T",
    mechanicType: "blast",
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 0,
    channelMs: 0,
    iconFile: "x.png",
    knockbackWu: 0,
    blastKnockbackWu: 0,
    chainKnockbackWu: 0,
    chainHopKnockbackWu: 0,
    ...partial,
  } as SpellDefinition;
}

function target(id: string, x: number, y: number, hp = 100): SpellEnemyTarget {
  const enemy = mockEnemyInstance({
    behavior: "meleeChaser",
    id,
    sprite: { x, y } as never,
    damageable: { id, hp, maxHp: hp, alive: true, team: "enemy" },
  });
  return {
    id,
    x,
    y,
    radius: 10,
    enemy,
    sprite: enemy.sprite,
    damageable: enemy.damageable,
  };
}

function fakeStatus() {
  return {
    applyRoot: vi.fn(),
    applyStun: vi.fn(),
    applySlow: vi.fn(),
    applyDot: vi.fn(),
  } as unknown as EnemySpellStatusMap & { applyStun: ReturnType<typeof vi.fn> };
}

const hp = (t: SpellEnemyTarget) => t.damageable.hp;

describe("applyNova", () => {
  it("requires a blast radius", () => {
    expect(() => applyNova(asScene(fakeScene()), 0, 0, def({}), [], 1)).toThrow(
      /missing blastRadiusWu/,
    );
  });

  it("hits living enemies whose edge is inside the radius, scaled by the multiplier", () => {
    const near = target("near", 50, 0);
    const edge = target("edge", 109, 0); // 109 - 10 radius < 100
    const far = target("far", 200, 0);
    const dead = target("dead", 10, 0);
    dead.damageable.alive = false;
    const status = fakeStatus();
    applyNova(
      asScene(fakeScene()),
      0,
      0,
      def({ blastRadiusWu: 100, baseDamage: 10, onHit: { stunMs: 500 } }),
      [near, edge, far, dead],
      2,
      status,
    );
    expect(hp(near)).toBe(80);
    expect(hp(edge)).toBe(80);
    expect(hp(far)).toBe(100);
    expect(hp(dead)).toBe(100);
    expect(status.applyStun.mock.calls.map((c) => c[0])).toEqual([
      "near",
      "edge",
    ]);
  });
});

describe("applySpellSwing / applySpellCone", () => {
  const swingDef = def({
    swingRangeWu: 100,
    swingArcDeg: 90,
    baseDamage: 12,
    knockbackWu: 50,
  });

  it("swing shows the player slash and damages + knocks back only enemies in the arc", () => {
    const scene = fakeScene();
    const ahead = target("ahead", 60, 0);
    const behind = target("behind", -60, 0);
    applySpellSwing(asScene(scene), 0, 0, 0, swingDef, [ahead, behind], 1);
    expect(scene.made("image")[0]!.args[2]).toBe(COMBAT_FX_TEXTURE.playerMelee);
    expect(hp(ahead)).toBe(88);
    expect(ahead.enemy.knockbackVx).toBeGreaterThan(0);
    expect(hp(behind)).toBe(100);
    expect(behind.enemy.knockbackVx).toBe(0);
  });

  it("cone FX can be suppressed while damage still applies", () => {
    const coneDef = def({ coneRangeWu: 100, coneArcDeg: 60, baseDamage: 5 });
    const scene = fakeScene();
    const inCone = target("in", 50, 5);
    const outside = target("out", 0, 50);
    const status = fakeStatus();
    applySpellCone(
      asScene(scene),
      0,
      0,
      0,
      { ...coneDef, onHit: { stunMs: 1 } },
      [inCone, outside],
      1,
      status,
      {
        showFx: false,
      },
    );
    expect(scene.created).toHaveLength(0);
    expect(hp(inCone)).toBe(95);
    expect(hp(outside)).toBe(100);
    expect(status.applyStun).toHaveBeenCalledWith("in", 1);
  });

  it("cone of fire uses three PVFX incinerate streams instead of the procedural wedge", () => {
    const scene = fakeScene({
      textures: PVFX_FX_ASSETS.map((a) => a.key),
      anims: Object.values(PVFX_ANIM),
    });
    applySpellCone(
      asScene(scene),
      0,
      0,
      0,
      def({
        id: "cone_of_fire" as SpellDefinition["id"],
        coneRangeWu: 100,
        coneArcDeg: 60,
      }),
      [],
      1,
    );
    expect(scene.made("graphics")).toHaveLength(0);
    expect(scene.made("sprite")).toHaveLength(3);
    expect(scene.made("sprite")[0]!.args[2]).toBe(PVFX_TEXTURE.incinerate);
  });

  it("cone of cold adds the ice hit burst on top of the cone wash", () => {
    const scene = fakeScene({
      textures: ICE_FX_ASSETS.map((a) => a.key),
      anims: Object.values(ICE_FX_ANIM),
    });
    applySpellCone(
      asScene(scene),
      0,
      0,
      0,
      def({
        id: "cone_of_cold" as SpellDefinition["id"],
        coneRangeWu: 100,
        coneArcDeg: 60,
      }),
      [],
      1,
    );
    expect(scene.made("graphics")).toHaveLength(1);
    expect(scene.made("sprite")[0]!.args[2]).toBe(ICE_FX_TEXTURE.boltHit);
  });
});

describe("applyInstantTargeted", () => {
  it("returns null when nothing is in range", () => {
    expect(
      applyInstantTargeted(
        asScene(fakeScene()),
        def({ groundTargetMaxRangeWu: 50, baseDamage: 10 }),
        [target("far", 500, 0)],
        null,
        0,
        0,
        1,
      ),
    ).toBeNull();
  });

  it("prefers the requested living target over the nearest one", () => {
    const near = target("near", 10, 0);
    const picked = target("picked", 40, 0);
    const id = applyInstantTargeted(
      asScene(fakeScene()),
      def({ groundTargetMaxRangeWu: 100, baseDamage: 10 }),
      [near, picked],
      "picked",
      0,
      0,
      1,
    );
    expect(id).toBe("picked");
    expect(hp(picked)).toBe(90);
    expect(hp(near)).toBe(100);
  });

  it("falls back to the nearest enemy when the requested one is dead", () => {
    const dead = target("dead", 50, 0);
    dead.damageable.alive = false;
    const near = target("near", 20, 0);
    const id = applyInstantTargeted(
      asScene(fakeScene()),
      def({ groundTargetMaxRangeWu: 100, baseDamage: 10 }),
      [dead, near],
      "dead",
      0,
      0,
      1,
    );
    expect(id).toBe("near");
  });

  it("the nearest-enemy fallback skips dead enemies", () => {
    // Regression: a dead enemy closer than any living one used to be picked.
    const dead = target("dead", 10, 0);
    dead.damageable.alive = false;
    const living = target("living", 60, 0);
    const id = applyInstantTargeted(
      asScene(fakeScene()),
      def({ groundTargetMaxRangeWu: 100, baseDamage: 10 }),
      [dead, living],
      null,
      0,
      0,
      1,
    );
    expect(id).toBe("living");
    expect(hp(living)).toBe(90);
    expect(hp(dead)).toBe(100);
  });

  it("returns null when only dead enemies are in range", () => {
    const dead = target("dead", 10, 0);
    dead.damageable.alive = false;
    expect(
      applyInstantTargeted(
        asScene(fakeScene()),
        def({ groundTargetMaxRangeWu: 100, baseDamage: 10 }),
        [dead],
        null,
        0,
        0,
        1,
      ),
    ).toBeNull();
    expect(hp(dead)).toBe(100);
  });

  it("burst damage hits the target, then splashes 65% around it (not re-pushing the target)", () => {
    const primary = target("p", 50, 0);
    const neighbour = target("n", 70, 0);
    applyInstantTargeted(
      asScene(fakeScene()),
      def({
        groundTargetMaxRangeWu: 200,
        baseDamage: 10,
        burstDamage: 20,
        blastRadiusWu: 40,
        knockbackWu: 30,
        blastKnockbackWu: 30,
      }),
      [primary, neighbour],
      null,
      0,
      0,
      1,
    );
    // primary: 10 hit + 20 burst + 13 splash; neighbour: 13 splash
    expect(hp(primary)).toBe(57);
    expect(hp(neighbour)).toBe(87);
    expect(neighbour.enemy.knockbackVx).toBeGreaterThan(0);
  });

  it("without burst, a blast radius splashes 65% of base damage", () => {
    const primary = target("p", 50, 0);
    const neighbour = target("n", 60, 0);
    const status = fakeStatus();
    applyInstantTargeted(
      asScene(fakeScene()),
      def({
        groundTargetMaxRangeWu: 200,
        baseDamage: 20,
        blastRadiusWu: 40,
        onHit: { stunMs: 9 },
      }),
      [primary, neighbour],
      null,
      0,
      0,
      1,
      status,
    );
    expect(hp(neighbour)).toBe(87);
    expect(hp(primary)).toBe(67);
    expect(status.applyStun).toHaveBeenCalledWith("p", 9);
  });

  it("a zero-damage spell still lets the splash push the primary", () => {
    const primary = target("p", 50, 0);
    applyInstantTargeted(
      asScene(fakeScene()),
      def({
        groundTargetMaxRangeWu: 200,
        baseDamage: 0,
        burstDamage: 10,
        blastRadiusWu: 40,
        blastKnockbackWu: 40,
      }),
      [primary],
      null,
      0,
      0,
      1,
    );
    expect(hp(primary)).toBe(83.5);
    expect(primary.enemy.knockbackVx).not.toBe(0);
  });
});

describe("applyChainLightning", () => {
  const chainDef = def({
    chainLightningHops: 3,
    chainLightningHopRangeWu: 60,
    baseDamage: 10,
    chainKnockbackWu: 20,
    chainHopKnockbackWu: 10,
  });

  it("does nothing without living enemies", () => {
    const scene = fakeScene();
    const dead = target("d", 10, 0);
    dead.damageable.alive = false;
    applyChainLightning(asScene(scene), 0, 0, chainDef, [dead], 1);
    expect(hp(dead)).toBe(100);
    expect(scene.created).toHaveLength(0);
  });

  it("starts at the requested enemy, hops within range and draws the chain", () => {
    const a = target("a", 100, 0);
    const b = target("b", 150, 0);
    const far = target("far", 400, 0);
    const scene = fakeScene();
    const status = fakeStatus();
    applyChainLightning(
      asScene(scene),
      0,
      0,
      { ...chainDef, onHit: { stunMs: 1 } },
      [a, b, far],
      1,
      "b",
      status,
    );
    expect(hp(a)).toBe(90);
    expect(hp(b)).toBeLessThan(100);
    expect(a.enemy.knockbackVx).not.toBe(0);
    expect(hp(far)).toBe(100);
    expect(scene.made("graphics")).toHaveLength(1);
    const stunned = status.applyStun.mock.calls.map((c) => c[0]);
    expect(stunned).toEqual(expect.arrayContaining(["a", "b"]));
    expect(stunned).not.toContain("far");
  });

  it("hits the start enemy once and spends every hop on other enemies", () => {
    // Regression: the first hop used to land on the start enemy itself
    // (distance 0), double-hitting it and wasting a hop.
    const a = target("a", 100, 0);
    const b = target("b", 140, 0);
    const c = target("c", 180, 0);
    const d = target("d", 220, 0);
    const e = target("e", 260, 0);
    const scene = fakeScene();
    applyChainLightning(
      asScene(scene),
      0,
      0,
      chainDef,
      [a, b, c, d, e],
      1,
      "a",
    );
    expect([a, b, c, d].map(hp)).toEqual([90, 90, 90, 90]);
    expect(hp(e)).toBe(100); // 3 hops: b, c, d
  });

  it("a lone enemy is struck once with no chain drawn", () => {
    const solo = target("solo", 50, 0);
    const scene = fakeScene();
    applyChainLightning(asScene(scene), 0, 0, chainDef, [solo], 1);
    expect(hp(solo)).toBe(90);
    expect(scene.made("graphics")).toHaveLength(0);
  });

  it("starts from the nearest enemy when no start is given", () => {
    const near = target("near", 30, 0);
    const other = target("other", 300, 0);
    applyChainLightning(asScene(fakeScene()), 0, 0, chainDef, [other, near], 1);
    expect(hp(near)).toBeLessThan(100);
    expect(hp(other)).toBe(100);
  });
});

describe("heals", () => {
  it("clamps to max HP and ignores non-positive amounts", () => {
    const d = {
      id: "p",
      hp: 50,
      maxHp: 60,
      alive: true,
      team: "player" as const,
    };
    applyHealAmount(d, 0);
    expect(d.hp).toBe(50);
    applyHealAmount(d, 25);
    expect(d.hp).toBe(60);
  });

  it("reports the applied heal and ignores overheal on the callback", () => {
    const onHealed = vi.fn();
    const d = {
      id: "p",
      hp: 50,
      maxHp: 60,
      alive: true,
      team: "player" as const,
      onHealed,
    };
    applyHealAmount(d, 4);
    expect(onHealed).toHaveBeenCalledWith(4);
    applyHealAmount(d, 20);
    expect(onHealed).toHaveBeenLastCalledWith(6);
    expect(d.hp).toBe(60);
  });

  it("revives the alive flag when a downed target is healed above zero", () => {
    const d = {
      id: "p",
      hp: 0,
      maxHp: 60,
      alive: false,
      team: "player" as const,
    };
    applyChanneledHeal(d, def({}));
    expect(d.hp).toBe(20);
    expect(d.alive).toBe(true);
    applyChanneledHeal(d, def({ healAmount: 5 }));
    expect(d.hp).toBe(25);
  });
});

describe("spawnSpellProjectile", () => {
  const bolt = (partial: Partial<SpellDefinition>) =>
    def({
      mechanicType: "projectile",
      projectileTextureKey: "fx_stone_throw",
      baseDamage: 8,
      ...partial,
    });

  it("requires a projectile texture", () => {
    expect(() =>
      spawnSpellProjectile(asScene(fakeScene()), 0, 0, 0, def({}), 1, "p"),
    ).toThrow(/no MobileRPG projectileTextureKey/);
  });

  it("fires along the angle with the spell's damage and default behaviour", () => {
    const scene = fakeScene();
    const p = spawnSpellProjectile(
      asScene(scene),
      5,
      6,
      Math.PI / 2,
      bolt({ projectileSpeedWu: 200 }),
      1.5,
      "p1",
    );
    expect(p.id).toBe("p1");
    expect(p.damage).toBe(12);
    expect(p.spellBehavior).toBe("default");
    expect(p.spellId).toBe("test_spell");
    const v = (
      p.sprite.body as unknown as { velocity: { x: number; y: number } }
    ).velocity;
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(200);
    expect(p.maxTravel).toBe(PLAYER_TUNING.rangedMaxRangeWu);
  });

  it("maps mechanics to projectile behaviours", () => {
    const scene = asScene(fakeScene());
    expect(() =>
      spawnSpellProjectile(
        scene,
        0,
        0,
        0,
        bolt({ mechanicType: "projectile_aoe" }),
        1,
        "a",
      ),
    ).toThrow(/missing blastRadiusWu/);
    const aoe = spawnSpellProjectile(
      scene,
      0,
      0,
      0,
      bolt({ mechanicType: "projectile_aoe", blastRadiusWu: 30 }),
      1,
      "a",
    );
    expect(aoe.spellBehavior).toBe("aoe_on_hit");
    expect(aoe.blastRadiusWu).toBe(30);

    const water = spawnSpellProjectile(
      scene,
      0,
      0,
      0,
      bolt({ id: "water_bolt" as SpellDefinition["id"] }),
      1,
      "w",
    );
    expect(water.spellBehavior).toBe("pierce");

    const tracking = spawnSpellProjectile(
      scene,
      0,
      0,
      0,
      bolt({ mechanicType: "tracking_projectile" }),
      1,
      "t",
      { trackEnemyId: "e7" },
    );
    expect(tracking.spellBehavior).toBe("tracking");
    expect(tracking.trackEnemyId).toBe("e7");

    const forced = spawnChanneledFireball(scene, 0, 0, 0, bolt({}), 1, "f");
    expect(forced.spellBehavior).toBe("default");
    const pierced = spawnSpellProjectile(scene, 0, 0, 0, bolt({}), 1, "x", {
      pierce: true,
    });
    expect(pierced.spellBehavior).toBe("pierce");
  });

  it("ice bolt uses the ice travel overlay and hides the physics body", () => {
    const scene = fakeScene({
      textures: ICE_FX_ASSETS.map((a) => a.key),
      anims: Object.values(ICE_FX_ANIM),
    });
    const p = spawnSpellProjectile(
      asScene(scene),
      0,
      0,
      0,
      bolt({ id: "ice_bolt" as SpellDefinition["id"] }),
      1,
      "i",
    );
    expect(scene.made("physics.sprite")[0]!.args[2]).toBe(
      ICE_FX_TEXTURE.boltRepeat,
    );
    expect(p.iceBoltFx?.phase).toBe("start");
    expect((p.sprite as unknown as { alpha: number }).alpha).toBe(0);
  });

  it("fire bolt switches to the PVFX fireball loop when the pack is loaded", () => {
    const scene = fakeScene({ textures: PVFX_FX_ASSETS.map((a) => a.key) });
    const p = spawnSpellProjectile(
      asScene(scene),
      0,
      0,
      0,
      bolt({ id: "fire_bolt" as SpellDefinition["id"] }),
      1,
      "f",
    );
    expect(scene.made("physics.sprite")[0]!.args[2]).toBe(
      PVFX_TEXTURE.fireballFlight,
    );
    expect(p.pvfxFlightFx).toBeDefined();
  });
});

describe("SpellEffects fallbacks", () => {
  it("nova uses default damage, skips dead enemies, and can apply on-hit", () => {
    const scene = fakeScene();
    const live = target("live", 5, 0, 80);
    const dead = target("dead", 5, 0, 0);
    dead.damageable.alive = false;
    const status = fakeStatus();
    applyNova(
      asScene(scene),
      0,
      0,
      def({
        blastRadiusWu: 40,
        onHit: { stunMs: 200 },
      }),
      [live, dead],
      1,
      status,
    );
    expect(hp(live)).toBeLessThan(80);
    expect(hp(dead)).toBe(0);
    expect(status.applyStun).toHaveBeenCalled();
  });

  it("blast, swing, and cone skip corpses and default the damage", () => {
    const scene = fakeScene();
    const live = target("live", 8, 0, 60);
    const dead = target("dead", 8, 0, 0);
    dead.damageable.alive = false;
    const status = fakeStatus();
    applySpellBlastAt(
      asScene(scene),
      0,
      0,
      def({ blastRadiusWu: 40, onHit: { slowMs: 100 } }),
      [live, dead],
      1,
      status,
    );
    applySpellSwing(
      asScene(scene),
      0,
      0,
      0,
      def({ swingRangeWu: 40, swingArcDeg: 90 }),
      [live, dead],
      1,
      status,
    );
    strikeSpellCone(
      asScene(scene),
      0,
      0,
      0,
      def({ coneRangeWu: 40, coneArcDeg: 90, onHit: { rootMs: 100 } }),
      [live, dead],
      1,
      status,
    );
    expect(hp(dead)).toBe(0);
  });

  it("instant targeted uses range and damage defaults and can splash", () => {
    const scene = fakeScene();
    const live = target("live", 8, 0, 80);
    const status = fakeStatus();
    const id = applyInstantTargeted(
      asScene(scene),
      def({
        onHit: { stunMs: 150 },
        blastRadiusWu: 40,
      }),
      [live],
      null,
      0,
      0,
      1,
      status,
    );
    expect(id).toBe("live");
    expect(hp(live)).toBeLessThan(80);
    expect(status.applyStun).toHaveBeenCalled();
    expect(
      applyInstantTargeted(asScene(scene), def({}), [], "missing", 0, 0, 1),
    ).toBeNull();
  });

  it("projectiles default trackEnemyId and chain default damage", () => {
    const bolt = spawnSpellProjectile(
      asScene(fakeScene()),
      0,
      0,
      0,
      def({
        mechanicType: "projectile",
        projectileTextureKey: "fx_stone_throw",
      }),
      1,
      "p",
    );
    expect(bolt.trackEnemyId ?? null).toBeNull();
    const a = target("a", 10, 0, 80);
    const b = target("b", 20, 0, 80);
    applyChainLightning(
      asScene(fakeScene()),
      0,
      0,
      def({
        chainLightningHopRangeWu: 80,
        chainLightningHops: 2,
      }),
      [a, b],
      1,
      "a",
    );
    expect(hp(a)).toBeLessThan(80);
  });

  it("skips on-hit when none is set and throws if a blast has no radius", () => {
    const scene = asScene(fakeScene());
    const live = target("live", 8, 0, 80);
    applyNova(scene, 0, 0, def({ blastRadiusWu: 40 }), [live], 1);
    expect(hp(live)).toBeLessThan(80);
    expect(() => applySpellBlastAt(scene, 0, 0, def({}), [live], 1)).toThrow(
      /missing blastRadiusWu/,
    );
    applySpellSwing(
      scene,
      0,
      0,
      0,
      def({
        swingRangeWu: 40,
        swingArcDeg: 90,
        onHit: { stunMs: 80 },
      }),
      [target("swing", 8, 0, 80)],
      1,
      fakeStatus(),
    );
    strikeSpellCone(
      scene,
      0,
      0,
      0,
      def({ coneRangeWu: 40, coneArcDeg: 90 }),
      [target("cone", 8, 0, 80)],
      1,
    );
    const bolt = spawnSpellProjectile(
      scene,
      0,
      0,
      0,
      def({
        mechanicType: "tracking_projectile",
        projectileTextureKey: "fx_stone_throw",
      }),
      1,
      "track",
    );
    expect(bolt.trackEnemyId ?? null).toBeNull();
    const burst = target("burst", 8, 0, 80);
    applyInstantTargeted(
      scene,
      def({ burstDamage: 10, baseDamage: 5 }),
      [burst],
      "burst",
      0,
      0,
      1,
    );
    expect(hp(burst)).toBeLessThan(80);
  });

  it("does not notify onHealed when the target is already at max hp", () => {
    const onHealed = vi.fn();
    const damageable = {
      id: "p",
      hp: 50,
      maxHp: 50,
      alive: true,
      team: "player" as const,
      onHealed,
    };
    applyHealAmount(damageable, 10);
    expect(onHealed).not.toHaveBeenCalled();
    expect(damageable.hp).toBe(50);
  });
});
