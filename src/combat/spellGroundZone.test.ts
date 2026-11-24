import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import type { SpellDefinition } from "../content/spells";
import type { Damageable } from "./DamageSystem";
import { EnemySpellStatusMap } from "./enemySpellStatus";
import { spawnGroundZone, tickSpellGroundZones } from "./spellGroundZone";
import type { EnemyHitTarget } from "./spellMechanics";

function mockScene(): Phaser.Scene {
  return {
    registry: { get: () => 1 },
  } as unknown as Phaser.Scene;
}

function channeledGroundDef(baseDamage: number): SpellDefinition {
  return {
    id: "blizzard",
    name: "Blizzard",
    shortLabel: "Bliz",
    mechanicType: "channeled",
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 1100,
    channelMs: 1500,
    channelTickMs: 250,
    baseDamage,
    blastRadiusWu: 80,
    iconFile: "blizzard.png",
    targetMode: "ground",
    damageFlavor: "frost",
  };
}

describe("spellGroundZone channeled damage", () => {
  it("deals baseDamage × mult over the channel (remainder on final tick)", () => {
    const def = channeledGroundDef(43);
    const mult = 1;
    const now = 0;
    const zone = spawnGroundZone(mockScene(), def, 0, 0, mult, now, {
      durationMs: def.channelMs,
    });
    const damageable: Damageable = {
      id: "e1",
      hp: 500,
      maxHp: 500,
      alive: true,
      team: "enemy",
    };
    const enemy: EnemyHitTarget & { damageable: Damageable; id: string } = {
      id: "e1",
      x: 0,
      y: 0,
      radius: 16,
      damageable,
    };
    let totalDamage = 0;
    damageable.onDamaged = (amount) => {
      totalDamage += amount;
    };
    const status = new EnemySpellStatusMap();
    const tickEvery = zone.tickEveryMs;
    for (let i = 0; i < 6; i++) {
      tickSpellGroundZones(
        mockScene(),
        [zone],
        now + (i + 1) * tickEvery,
        tickEvery,
        [enemy],
        status,
        mult,
      );
    }
    expect(totalDamage).toBe(43);
    expect(zone.channelTicksDone).toBe(6);
  });

  it("linger zones use dot dps, not channel baseDamage split", () => {
    const def: SpellDefinition = {
      ...channeledGroundDef(12),
      lingerMs: 2000,
      lingerTickMs: 500,
      onHit: { dotDps: 4, dotMs: 2000 },
    };
    const zone = spawnGroundZone(mockScene(), def, 0, 0, 1, 0, {
      durationMs: def.lingerMs!,
      lingerDot: true,
    });
    expect(zone.tickDamage).toBe(0);
    expect(zone.lingerDotDps).toBe(4);
    expect(zone.channelMaxTicks).toBeUndefined();
  });

  it("applies burstDamage once on first tick pass", () => {
    const def = {
      ...channeledGroundDef(0),
      burstDamage: 20,
    };
    const damageable: Damageable = {
      id: "e1",
      hp: 500,
      maxHp: 500,
      alive: true,
      team: "enemy",
    };
    const amounts: number[] = [];
    damageable.onDamaged = (a) => amounts.push(a);
    const enemy: EnemyHitTarget & { damageable: Damageable; id: string } = {
      id: "e1",
      x: 0,
      y: 0,
      radius: 16,
      damageable,
    };
    const zone = spawnGroundZone(mockScene(), def, 0, 0, 1, 0, {
      durationMs: def.channelMs,
      includeBurst: true,
    });
    tickSpellGroundZones(
      mockScene(),
      [zone],
      zone.tickEveryMs,
      zone.tickEveryMs,
      [enemy],
      new EnemySpellStatusMap(),
      1,
    );
    expect(zone.didBurst).toBe(true);
    expect(amounts).toEqual([20]);
  });
});