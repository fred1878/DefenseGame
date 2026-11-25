import { describe, expect, it } from "vitest";
import {
  DAMAGE_NUMBER_FONT_FAMILY,
  DAMAGE_NUMBER_FONT_PATH,
  DAMAGE_NUMBER_KINDS,
  DAMAGE_NUMBERS,
  queueDamageNumberFont,
} from "../config/damageNumbers";
import {
  areDamageNumbersEnabled,
  aggregationKey,
  createDamageNumberState,
  damageNumberKindFromSource,
  damageNumberPose,
  damageNumberQueryFromLocation,
  displayDamageAmount,
  expireDamageNumbers,
  formatDamageNumberText,
  spawnOrAggregateDamageNumber,
  styleForKind,
} from "./damageNumbers";

describe("damageNumberKindFromSource", () => {
  it("maps each combat flavor and heal onto a presentation kind", () => {
    expect(damageNumberKindFromSource({ flavor: "physical" })).toBe("physical");
    expect(damageNumberKindFromSource({ flavor: "fire" })).toBe("fire");
    expect(damageNumberKindFromSource({ flavor: "frost" })).toBe("frost");
    expect(damageNumberKindFromSource({ flavor: "lightning" })).toBe(
      "lightning",
    );
    expect(damageNumberKindFromSource({ flavor: "water" })).toBe("water");
    expect(damageNumberKindFromSource({ flavor: "poison" })).toBe("poison");
    expect(damageNumberKindFromSource({ flavor: "plague" })).toBe("poison");
    expect(damageNumberKindFromSource({ heal: true })).toBe("heal");
  });

  it("treats missing or unknown flavors as physical", () => {
    expect(damageNumberKindFromSource({})).toBe("physical");
    expect(damageNumberKindFromSource({ flavor: "arcane" })).toBe("physical");
  });

  it("forces lightning spell ids to the lightning style", () => {
    expect(
      damageNumberKindFromSource({
        flavor: "physical",
        spellId: "lightning_bolt",
      }),
    ).toBe("lightning");
    expect(
      damageNumberKindFromSource({
        flavor: "physical",
        spellId: "chain_lightning",
      }),
    ).toBe("lightning");
    expect(
      damageNumberKindFromSource({ flavor: "fire", spellId: "fire_bolt" }),
    ).toBe("fire");
  });

  it("prefers heal over flavor when both are set", () => {
    expect(damageNumberKindFromSource({ flavor: "fire", heal: true })).toBe(
      "heal",
    );
  });
});

describe("formatDamageNumberText", () => {
  it("rounds amounts and prefixes heals with +", () => {
    expect(formatDamageNumberText(12.4, "physical")).toBe("12");
    expect(formatDamageNumberText(12.6, "fire")).toBe("13");
    expect(formatDamageNumberText(8, "heal")).toBe("+8");
    expect(styleForKind("heal").prefix).toBe("+");
  });

  it("never displays zero for a positive fractional tick", () => {
    expect(displayDamageAmount(0.2)).toBe(1);
    expect(displayDamageAmount(0)).toBe(0);
    expect(formatDamageNumberText(0.2, "fire")).toBe("1");
  });
});

describe("areDamageNumbersEnabled", () => {
  it("follows the config flag when no query override is set", () => {
    expect(
      areDamageNumbersEnabled({}, { ...DAMAGE_NUMBERS, enabled: true }),
    ).toBe(true);
    expect(
      areDamageNumbersEnabled({}, { ...DAMAGE_NUMBERS, enabled: false }),
    ).toBe(false);
  });

  it("defaults off under e2e unless dmgNum forces them on", () => {
    expect(areDamageNumbersEnabled({ e2e: true })).toBe(false);
    expect(areDamageNumbersEnabled({ e2e: true, dmgNum: "1" })).toBe(true);
    expect(areDamageNumbersEnabled({ dmgNum: "0" })).toBe(false);
    expect(areDamageNumbersEnabled({ dmgNum: "false" })).toBe(false);
    expect(areDamageNumbersEnabled({ dmgNum: "true" })).toBe(true);
  });

  it("parses dmgNum and e2e from a location href", () => {
    expect(
      damageNumberQueryFromLocation("http://localhost:4173/?e2e=1&dmgNum=1"),
    ).toEqual({ dmgNum: "1", e2e: true });
    expect(damageNumberQueryFromLocation("http://localhost:4173/")).toEqual({
      e2e: false,
    });
    expect(damageNumberQueryFromLocation("not a url")).toEqual({});
    expect(damageNumberQueryFromLocation(undefined)).toEqual({});
  });
});

describe("spawnOrAggregateDamageNumber", () => {
  const cfg = { ...DAMAGE_NUMBERS, maxActive: 3, aggregateWindowMs: 100 };

  it("spawns a new floater and ignores non-positive amounts", () => {
    const empty = createDamageNumberState();
    const ignored = spawnOrAggregateDamageNumber(
      empty,
      { targetId: "e1", x: 0, y: 0, amount: 0, kind: "fire" },
      0,
      cfg,
    );
    expect(ignored.action).toBe("ignored");
    expect(ignored.state.active).toHaveLength(0);

    const spawned = spawnOrAggregateDamageNumber(
      empty,
      { targetId: "e1", x: 10, y: 20, amount: 5, kind: "fire" },
      0,
      cfg,
    );
    expect(spawned.action).toBe("spawn");
    expect(spawned.state.active).toHaveLength(1);
    expect(spawned.state.active[0]?.amount).toBe(5);
    expect(empty.active).toHaveLength(0);
  });

  it("combines rapid ticks on the same target and kind", () => {
    let state = createDamageNumberState();
    const first = spawnOrAggregateDamageNumber(
      state,
      { targetId: "e1", x: 0, y: 0, amount: 4, kind: "fire" },
      0,
      cfg,
    );
    state = first.state;
    const second = spawnOrAggregateDamageNumber(
      state,
      { targetId: "e1", x: 2, y: -1, amount: 3, kind: "fire" },
      80,
      cfg,
    );
    expect(second.action).toBe("aggregate");
    expect(second.id).toBe(first.id);
    expect(second.state.active).toHaveLength(1);
    expect(second.state.active[0]?.amount).toBe(7);
    expect(second.state.active[0]?.startX).toBe(2);
    expect(state.active[0]?.amount).toBe(4);
  });

  it("does not merge different kinds, targets, or ticks outside the window", () => {
    let state = createDamageNumberState();
    state = spawnOrAggregateDamageNumber(
      state,
      { targetId: "e1", x: 0, y: 0, amount: 4, kind: "fire" },
      0,
      cfg,
    ).state;
    state = spawnOrAggregateDamageNumber(
      state,
      { targetId: "e1", x: 0, y: 0, amount: 4, kind: "frost" },
      10,
      cfg,
    ).state;
    state = spawnOrAggregateDamageNumber(
      state,
      { targetId: "e2", x: 0, y: 0, amount: 4, kind: "fire" },
      10,
      cfg,
    ).state;
    state = spawnOrAggregateDamageNumber(
      state,
      { targetId: "e1", x: 0, y: 0, amount: 4, kind: "fire" },
      200,
      cfg,
    ).state;
    expect(state.active).toHaveLength(3);
  });

  it("keeps crits out of the normal aggregate bucket", () => {
    expect(aggregationKey("e1", "fire", true)).not.toBe(
      aggregationKey("e1", "fire", false),
    );
    let state = createDamageNumberState();
    state = spawnOrAggregateDamageNumber(
      state,
      { targetId: "e1", x: 0, y: 0, amount: 10, kind: "physical" },
      0,
      cfg,
    ).state;
    const crit = spawnOrAggregateDamageNumber(
      state,
      {
        targetId: "e1",
        x: 0,
        y: 0,
        amount: 20,
        kind: "physical",
        isCrit: true,
      },
      10,
      cfg,
    );
    expect(crit.action).toBe("spawn");
    expect(crit.state.active).toHaveLength(2);
  });

  it("evicts the oldest floaters when the cap is exceeded", () => {
    let state = createDamageNumberState();
    const ids: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const result = spawnOrAggregateDamageNumber(
        state,
        { targetId: `e${i}`, x: 0, y: 0, amount: 1, kind: "physical" },
        i * 200,
        cfg,
      );
      state = result.state;
      ids.push(result.id);
      if (i === 3) {
        expect(result.evictedIds).toEqual([ids[0]]);
      }
    }
    expect(state.active).toHaveLength(3);
    expect(state.active.map((e) => e.id)).toEqual(ids.slice(1));
  });
});

describe("expireDamageNumbers and pose", () => {
  it("expires floaters after their style duration", () => {
    let state = createDamageNumberState();
    const fireDuration = DAMAGE_NUMBERS.styles.fire.motion.durationMs;
    state = spawnOrAggregateDamageNumber(
      state,
      { targetId: "e1", x: 0, y: 0, amount: 5, kind: "fire" },
      0,
    ).state;
    const mid = expireDamageNumbers(state, fireDuration - 1);
    expect(mid.expiredIds).toEqual([]);
    expect(mid.state.active).toHaveLength(1);
    const done = expireDamageNumbers(state, fireDuration);
    expect(done.expiredIds).toEqual([1]);
    expect(done.state.active).toHaveLength(0);
  });

  it("drifts upward, fades late, and punches in at spawn", () => {
    const state = spawnOrAggregateDamageNumber(
      createDamageNumberState(),
      { targetId: "e1", x: 10, y: 40, amount: 5, kind: "physical" },
      0,
    ).state;
    const entry = state.active[0]!;
    const start = damageNumberPose(entry, 0);
    expect(start.x).toBeCloseTo(10, 5);
    expect(start.y).toBeCloseTo(40, 5);
    expect(start.alpha).toBe(1);
    expect(start.scale).toBeGreaterThan(1);

    const mid = damageNumberPose(entry, 400);
    expect(mid.y).toBeLessThan(start.y);
    expect(mid.scale).toBeCloseTo(1, 2);

    const end = damageNumberPose(
      entry,
      DAMAGE_NUMBERS.styles.physical.motion.durationMs - 1,
    );
    expect(end.alpha).toBeLessThan(0.2);
    expect(end.y).toBeLessThan(mid.y);
  });

  it("applies flavor motion: fire flicker, lightning jitter, water wave", () => {
    const spawn = (kind: "fire" | "lightning" | "water") =>
      spawnOrAggregateDamageNumber(
        createDamageNumberState(),
        { targetId: "e1", x: 0, y: 0, amount: 5, kind },
        0,
      ).state.active[0]!;

    const fireA = damageNumberPose(spawn("fire"), 40);
    const fireB = damageNumberPose(spawn("fire"), 80);
    expect(fireA.alpha).not.toBeCloseTo(fireB.alpha, 3);

    const boltA = damageNumberPose(spawn("lightning"), 16);
    const boltB = damageNumberPose(spawn("lightning"), 48);
    expect(
      Math.abs(boltA.x - boltB.x) + Math.abs(boltA.y - boltB.y),
    ).toBeGreaterThan(0);

    const water = damageNumberPose(spawn("water"), 200);
    expect(water.x).not.toBeCloseTo(0, 2);
  });

  it("uses a bigger pop scale for crits", () => {
    const normal = spawnOrAggregateDamageNumber(
      createDamageNumberState(),
      { targetId: "e1", x: 0, y: 0, amount: 5, kind: "physical" },
      0,
    ).state.active[0]!;
    const crit = spawnOrAggregateDamageNumber(
      createDamageNumberState(),
      {
        targetId: "e1",
        x: 0,
        y: 0,
        amount: 5,
        kind: "physical",
        isCrit: true,
      },
      0,
    ).state.active[0]!;
    expect(damageNumberPose(crit, 0).scale).toBeGreaterThan(
      damageNumberPose(normal, 0).scale,
    );
  });
});

describe("DAMAGE_NUMBERS config", () => {
  it("defines a style for every presentation kind and a licensed font", () => {
    for (const kind of DAMAGE_NUMBER_KINDS) {
      const style = DAMAGE_NUMBERS.styles[kind];
      expect(style.fill).toMatch(/^#/);
      expect(style.stroke).toMatch(/^#/);
      expect(style.fontSize).toBeGreaterThan(0);
      expect(style.critFontSize).toBeGreaterThan(style.fontSize);
      expect(style.motion.durationMs).toBeGreaterThan(0);
    }
    expect(DAMAGE_NUMBERS.fontFamily).toBe(DAMAGE_NUMBER_FONT_FAMILY);
    expect(DAMAGE_NUMBER_FONT_PATH).toContain("pixelify-sans");
    expect(DAMAGE_NUMBERS.styles.heal.prefix).toBe("+");
  });

  it("queues the font on a Phaser-like loader", () => {
    const calls: unknown[] = [];
    queueDamageNumberFont({ font: (cfg) => calls.push(cfg) });
    expect(calls).toEqual([
      {
        key: DAMAGE_NUMBER_FONT_FAMILY,
        url: DAMAGE_NUMBER_FONT_PATH,
        format: "truetype",
        descriptors: { weight: "700", style: "normal" },
      },
    ]);
  });
});
