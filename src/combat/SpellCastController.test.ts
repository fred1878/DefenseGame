import { describe, expect, it } from "vitest";
import { spellById } from "../content/spells";
import { spellCastMs } from "../content/spellTargeting";
import type { Damageable } from "./DamageSystem";
import { applyChanneledHeal } from "./SpellEffects";
import { SpellCastController } from "./SpellCastController";

describe("SpellCastController", () => {
  it("interrupts auto cast windup when stick moves", () => {
    const c = new SpellCastController();
    expect(c.tryBeginCast("fire_bolt", "auto")).toBe("windup");
    const cut = c.updateChannel(50, 0.5, 0);
    expect(cut.type).toBe("interrupted");
    expect(c.isChanneling()).toBe(false);
  });

  it("interrupts auto channel when stick moves", () => {
    const c = new SpellCastController();
    expect(c.tryBeginCast("heal", "auto")).toBe("channel");
    const mid = c.updateChannel(400, 0, 0);
    expect(mid.type).toBe("channeling");
    const cut = c.updateChannel(10, 0.5, 0);
    expect(cut.type).toBe("interrupted");
    expect(c.isChanneling()).toBe(false);
  });

  it("interrupts manual cast windup when stick moves", () => {
    const c = new SpellCastController();
    expect(c.tryBeginCast("fire_bolt", "manual")).toBe("windup");
    const mid = c.updateChannel(50, 0, 0);
    expect(mid.type).toBe("windup");
    const cut = c.updateChannel(10, 0.5, 0);
    expect(cut.type).toBe("interrupted");
    expect(c.isChanneling()).toBe(false);
  });

  it("interrupts manual channel when stick moves and clears armed cooldown", () => {
    const healDef = spellById("heal");
    const c = new SpellCastController();
    expect(c.tryBeginCast("heal", "manual")).toBe("channel");
    expect(c.getCooldownRemaining("heal")).toBe(healDef!.cooldownMs);
    expect(c.updateChannel(10, 0.5, 0).type).toBe("interrupted");
    expect(c.getCooldownRemaining("heal")).toBe(0);
  });

  it("completes windup-only meteor when still", () => {
    const c = new SpellCastController();
    c.tryBeginCast("meteor");
    expect(c.getCastPhase()).toBe("windup");
    const mid = c.updateChannel(500, 0, 0);
    expect(mid.type).toBe("windup");
    const done = c.updateChannel(800, 0, 0);
    expect(done.type).toBe("completed");
    if (done.type === "completed") expect(done.spellId).toBe("meteor");
  });

  it("reports channel phase after windup and on channel-only heal", () => {
    const heal = new SpellCastController();
    expect(heal.tryBeginCast("heal")).toBe("channel");
    expect(heal.getCastPhase()).toBe("channeling");

    const bliz = new SpellCastController();
    expect(bliz.tryBeginCast("blizzard")).toBe("windup");
    expect(bliz.getCastPhase()).toBe("windup");
    bliz.updateChannel(900, 0, 0);
    expect(bliz.getCastPhase()).toBe("channeling");
  });

  it("completes flamestrike after windup only (no channelMs)", () => {
    const def = spellById("flamestrike");
    expect(def?.channelMs).toBe(0);
    const windupMs = def ? spellCastMs(def) : 0;
    expect(windupMs).toBeGreaterThan(0);
    const c = new SpellCastController();
    expect(c.tryBeginCast("flamestrike")).toBe("windup");
    const done = c.updateChannel(windupMs + 1, 0, 0);
    expect(done.type).toBe("completed");
    if (done.type === "completed") expect(done.spellId).toBe("flamestrike");
    expect(c.isChanneling()).toBe(false);
  });

  it("casts instant nova without channeling", () => {
    const c = new SpellCastController();
    const def = c.tryBeginCast("fire_nova");
    expect(def).not.toBe(false);
    expect(def).not.toBe("channel");
    expect(c.isChanneling()).toBe(false);
  });

  it("arms channeled spell cooldown when windup completes into channel (blizzard)", () => {
    const blizDef = spellById("blizzard");
    expect(blizDef).toBeTruthy();
    const windupMs = blizDef ? spellCastMs(blizDef) : 0;
    const c = new SpellCastController();
    expect(c.tryBeginCast("blizzard")).toBe("windup");
    expect(c.getCooldownRemaining("blizzard")).toBe(0);
    const entering = c.updateChannel(windupMs, 0, 0);
    expect(entering.type).toBe("channeling");
    expect(c.getCooldownRemaining("blizzard")).toBe(blizDef!.cooldownMs);
  });

  it("arms channeled spell cooldown at channel start on cast begin (heal, cone_of_fire)", () => {
    const healDef = spellById("heal");
    const coneDef = spellById("cone_of_fire");
    expect(healDef?.channelMs).toBeGreaterThan(0);
    expect(coneDef?.channelMs).toBeGreaterThan(0);
    expect(spellCastMs(coneDef!)).toBe(0);

    const heal = new SpellCastController();
    expect(heal.tryBeginCast("heal")).toBe("channel");
    expect(heal.getCooldownRemaining("heal")).toBe(healDef!.cooldownMs);

    const cone = new SpellCastController();
    expect(cone.tryBeginCast("cone_of_fire")).toBe("channel");
    expect(cone.getCooldownRemaining("cone_of_fire")).toBe(coneDef!.cooldownMs);
  });

  it("does not leave cooldown armed on auto interrupt during windup or channel", () => {
    const blizDef = spellById("blizzard");
    const windupMs = blizDef ? spellCastMs(blizDef) : 0;
    const windupCut = new SpellCastController();
    windupCut.tryBeginCast("blizzard", "auto");
    windupCut.updateChannel(windupMs - 50, 0, 0);
    expect(windupCut.updateChannel(10, 0.5, 0).type).toBe("interrupted");
    expect(windupCut.getCooldownRemaining("blizzard")).toBe(0);

    const heal = new SpellCastController();
    heal.tryBeginCast("heal", "auto");
    expect(heal.getCooldownRemaining("heal")).toBe(spellById("heal")!.cooldownMs);
    expect(heal.updateChannel(10, 0.5, 0).type).toBe("interrupted");
    expect(heal.getCooldownRemaining("heal")).toBe(0);
  });

  it("ticks Blizzard cooldown during channel and does not reset on complete", () => {
    const blizDef = spellById("blizzard");
    expect(blizDef).toBeTruthy();
    const windupMs = spellCastMs(blizDef!);
    const channelMs = blizDef!.channelMs;
    const cdMs = blizDef!.cooldownMs;
    const c = new SpellCastController();
    c.tryBeginCast("blizzard");
    c.updateChannel(windupMs, 0, 0);
    expect(c.getCooldownRemaining("blizzard")).toBe(cdMs);
    const channelSlice = 600;
    c.updateChannel(channelSlice, 0, 0);
    c.tickCooldowns(channelSlice);
    const expectedRemaining = cdMs - channelSlice;
    expect(c.getCooldownRemaining("blizzard")).toBe(expectedRemaining);
    const done = c.updateChannel(channelMs - channelSlice + 1, 0, 0);
    expect(done.type).toBe("completed");
    expect(c.getCooldownRemaining("blizzard")).toBe(expectedRemaining);
  });

  it("ticks heal cooldown during channel and preserves elapsed CD on complete", () => {
    const healDef = spellById("heal");
    expect(healDef?.channelMs).toBeGreaterThan(0);
    const channelMs = healDef!.channelMs;
    const cdMs = healDef!.cooldownMs;
    const c = new SpellCastController();
    c.tryBeginCast("heal");
    expect(c.getCooldownRemaining("heal")).toBe(cdMs);
    const slice = 400;
    c.updateChannel(slice, 0, 0);
    c.tickCooldowns(slice);
    const expected = cdMs - slice;
    expect(c.getCooldownRemaining("heal")).toBe(expected);
    const done = c.updateChannel(channelMs - slice + 1, 0, 0);
    expect(done.type).toBe("completed");
    expect(c.getCooldownRemaining("heal")).toBe(expected);
  });

  it("completes flash_heal after windup only and starts cooldown", () => {
    const def = spellById("flash_heal");
    expect(def?.channelMs).toBe(0);
    const windupMs = def ? spellCastMs(def) : 0;
    expect(windupMs).toBeGreaterThan(0);

    const c = new SpellCastController();
    expect(c.tryBeginCast("flash_heal")).toBe("windup");
    expect(c.getCastPhase()).toBe("windup");
    expect(c.getCastPhase()).not.toBe("channeling");

    const mid = c.updateChannel(windupMs - 1, 0, 0);
    expect(mid.type).toBe("windup");

    const done = c.updateChannel(2, 0, 0);
    expect(done.type).toBe("completed");
    if (done.type === "completed") {
      expect(done.spellId).toBe("flash_heal");
      const damageable: Damageable = {
        id: "player",
        hp: 10,
        maxHp: 100,
        alive: true,
        team: "player",
      };
      applyChanneledHeal(damageable, done.def);
      expect(damageable.hp).toBe(10 + (def?.healAmount ?? 0));
    }
    expect(c.isChanneling()).toBe(false);
    expect(c.getCooldownRemaining("flash_heal")).toBe(def!.cooldownMs);
  });
});