import { describe, expect, it, vi } from "vitest";
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

  it("throws when a zone is spawned without a blast radius", () => {
    const def = { ...channeledGroundDef(10) };
    delete (def as { blastRadiusWu?: number }).blastRadiusWu;
    expect(() => spawnGroundZone(mockScene(), def, 0, 0, 1, 0)).toThrow(
      /blastRadiusWu/,
    );
  });

  it("defaults duration, tick rate, and fire flavor for linger zones", () => {
    const def = channeledGroundDef(10);
    delete (def as { damageFlavor?: string }).damageFlavor;
    delete (def as { channelMs?: number }).channelMs;
    delete (def as { lingerTickMs?: number }).lingerTickMs;
    def.onHit = { dotDps: 2, dotMs: 1000 };
    const zone = spawnGroundZone(mockScene(), def, 5, 6, 1, 100, {
      lingerDot: true,
    } as { durationMs: number; lingerDot: boolean });
    expect(zone.expiresAt).toBe(100 + 2500);
    expect(zone.tickEveryMs).toBe(250);
    expect(zone.damageFlavor).toBe("fire");
    expect(zone.tickDamage).toBe(0);
  });

  it("skips burst and ticks on dead targets and expires finished zones", () => {
    const def = {
      ...channeledGroundDef(8),
      burstDamage: 12,
      onHit: { stunMs: 100 },
    };
    const dead: Damageable = {
      id: "d",
      hp: 0,
      maxHp: 10,
      alive: false,
      team: "enemy",
    };
    const live: Damageable = {
      id: "l",
      hp: 40,
      maxHp: 40,
      alive: true,
      team: "enemy",
    };
    const zones = tickSpellGroundZones(
      mockScene(),
      [
        spawnGroundZone(mockScene(), def, 0, 0, 1, 0, {
          durationMs: 200,
          includeBurst: true,
        }),
      ],
      500,
      250,
      [
        { id: "d", x: 0, y: 0, radius: 16, damageable: dead },
        { id: "l", x: 0, y: 0, radius: 16, damageable: live },
      ],
      new EnemySpellStatusMap(),
      1,
    );
    expect(live.hp).toBeLessThan(40);
    expect(zones).toEqual([]);
  });

  it("skips dealing damage when a linger tick would be zero", () => {
    const def: SpellDefinition = {
      ...channeledGroundDef(0),
      onHit: { dotDps: 0, dotMs: 1000 },
    };
    const zone = spawnGroundZone(mockScene(), def, 0, 0, 1, 0, {
      durationMs: 1000,
      lingerDot: true,
    });
    const damageable: Damageable = {
      id: "e1",
      hp: 20,
      maxHp: 20,
      alive: true,
      team: "enemy",
    };
    tickSpellGroundZones(
      mockScene(),
      [zone],
      500,
      500,
      [{ id: "e1", x: 0, y: 0, radius: 16, damageable }],
      new EnemySpellStatusMap(),
      1,
    );
    expect(damageable.hp).toBe(20);
  });

  it("invokes destroyLingerFx when a linger zone expires", () => {
    const def: SpellDefinition = {
      ...channeledGroundDef(0),
      lingerMs: 500,
      onHit: { dotDps: 4, dotMs: 500 },
    };
    const destroy = vi.fn();
    const zone = spawnGroundZone(mockScene(), def, 0, 0, 1, 0, {
      durationMs: 500,
      lingerDot: true,
    });
    zone.destroyLingerFx = destroy;
    tickSpellGroundZones(
      mockScene(),
      [zone],
      600,
      0,
      [],
      new EnemySpellStatusMap(),
      1,
    );
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("ticks linger DoT without counting channel remainder ticks", () => {
    const def: SpellDefinition = {
      ...channeledGroundDef(0),
      lingerMs: 1000,
      lingerTickMs: 250,
      onHit: { dotDps: 8, dotMs: 1000 },
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
      durationMs: def.lingerMs!,
      lingerDot: true,
    });
    tickSpellGroundZones(
      mockScene(),
      [zone],
      250,
      250,
      [enemy],
      new EnemySpellStatusMap(),
      1,
    );
    expect(amounts[0]).toBeCloseTo(2);
    expect(zone.channelTicksDone).toBeUndefined();
  });
});
