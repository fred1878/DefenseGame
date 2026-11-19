import { describe, expect, it } from "vitest";
import { SpellCastController } from "./SpellCastController";

describe("SpellCastController", () => {
  it("interrupts cast windup when stick moves", () => {
    const c = new SpellCastController();
    expect(c.tryBeginCast("fire_bolt")).toBe("windup");
    const cut = c.updateChannel(50, 0.5, 0);
    expect(cut.type).toBe("interrupted");
    expect(c.isChanneling()).toBe(false);
  });

  it("interrupts channel when stick moves", () => {
    const c = new SpellCastController();
    expect(c.tryBeginCast("heal")).toBe("channel");
    const mid = c.updateChannel(400, 0, 0);
    expect(mid.type).toBe("channeling");
    const cut = c.updateChannel(10, 0.5, 0);
    expect(cut.type).toBe("interrupted");
    expect(c.isChanneling()).toBe(false);
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

  it("stays channeling for flamestrike linger after effect channel", () => {
    const c = new SpellCastController();
    expect(c.tryBeginCast("flamestrike")).toBe("windup");
    c.updateChannel(650, 0, 0);
    const lingerStart = c.updateChannel(3500, 0, 0);
    expect(lingerStart.type).toBe("effect_channel_complete");
    expect(c.isChanneling()).toBe(true);
    const lingerTick = c.updateChannel(500, 0, 0);
    expect(lingerTick.type).toBe("channeling");
    if (lingerTick.type === "channeling") expect(lingerTick.linger).toBe(true);
    const done = c.updateChannel(3000, 0, 0);
    expect(done.type).toBe("completed");
    expect(c.isChanneling()).toBe(false);
  });

  it("casts instant nova without channeling", () => {
    const c = new SpellCastController();
    const def = c.tryBeginCast("fire_nova");
    expect(def).not.toBe(false);
    expect(def).not.toBe("channel");
    expect(c.isChanneling()).toBe(false);
  });
});