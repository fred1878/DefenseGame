import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "../core/configValidation";
import { applySpellBlastAt } from "./SpellEffects";
import { mockEnemyInstance } from "../test/testEnemyInstance";
import type { SpellDefinition } from "../content/spells";

function blastDef(partial: Partial<SpellDefinition> = {}): SpellDefinition {
  return {
    id: "test_blast",
    name: "Test",
    shortLabel: "T",
    mechanicType: "blast",
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 0,
    channelMs: 0,
    iconFile: "x.png",
    blastRadiusWu: 100,
    baseDamage: 10,
    blastKnockbackWu: 100,
    ...partial,
  };
}

function sceneWithRegistry() {
  return {
    registry: {
      get: () => undefined,
    },
  } as unknown as import("phaser").Scene;
}

describe("applySpellBlastAt knockback", () => {
  it("throws when blastKnockback is omitted", () => {
    const scene = sceneWithRegistry();
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      sprite: { x: 100, y: 100 } as never,
    });
    const def = blastDef();
    delete def.blastKnockbackWu;
    expect(() =>
      applySpellBlastAt(
        scene,
        100,
        100,
        def,
        [
          {
            id: enemy.id,
            x: enemy.sprite.x,
            y: enemy.sprite.y,
            radius: 20,
            enemy,
            sprite: enemy.sprite,
            damageable: enemy.damageable,
          },
        ],
        1,
      ),
    ).toThrow(ConfigLoadError);
  });

  it("pushes enemies radially from the blast center, not the caster", () => {
    const scene = sceneWithRegistry();
    const east = mockEnemyInstance({
      behavior: "meleeChaser",
      id: "east",
      sprite: { x: 150, y: 100 } as never,
    });
    const west = mockEnemyInstance({
      behavior: "meleeChaser",
      id: "west",
      sprite: { x: 50, y: 100 } as never,
    });
    const blastX = 100;
    const blastY = 100;
    const targets = [
      {
        id: east.id,
        x: east.sprite.x,
        y: east.sprite.y,
        radius: 20,
        enemy: east,
        sprite: east.sprite,
        damageable: east.damageable,
      },
      {
        id: west.id,
        x: west.sprite.x,
        y: west.sprite.y,
        radius: 20,
        enemy: west,
        sprite: west.sprite,
        damageable: west.damageable,
      },
    ];

    applySpellBlastAt(scene, blastX, blastY, blastDef(), targets, 1);

    expect(east.knockbackVx).toBeGreaterThan(0);
    expect(west.knockbackVx).toBeLessThan(0);
    expect(Math.abs(east.knockbackVy)).toBeLessThan(1);
    expect(Math.abs(west.knockbackVy)).toBeLessThan(1);
  });

  it("still applies outward knockback when an enemy sits on the blast origin", () => {
    const scene = sceneWithRegistry();
    const onCenter = mockEnemyInstance({
      behavior: "meleeChaser",
      sprite: { x: 200, y: 200 } as never,
    });
    const targets = [
      {
        id: onCenter.id,
        x: onCenter.sprite.x,
        y: onCenter.sprite.y,
        radius: 20,
        enemy: onCenter,
        sprite: onCenter.sprite,
        damageable: onCenter.damageable,
      },
    ];

    applySpellBlastAt(scene, 200, 200, blastDef(), targets, 1);

    expect(
      Math.hypot(onCenter.knockbackVx, onCenter.knockbackVy),
    ).toBeGreaterThan(0);
  });
});
