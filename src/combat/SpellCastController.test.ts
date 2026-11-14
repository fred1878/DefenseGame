import { describe, expect, it } from "vitest";
import { SpellCastController } from "./SpellCastController";

describe("SpellCastController", () => {
  it("interrupts channel when stick moves", () => {
    const c = new SpellCastController();
    expect(c.tryBeginCast("heal")).toBe("channel");
    const mid = c.updateChannel(400, 0, 0);
    expect(mid.type).toBe("channeling");
    const cut = c.updateChannel(10, 0.5, 0);
    expect(cut.type).toBe("interrupted");
    expect(c.isChanneling()).toBe(false);
  });

  it("completes channel when still and time elapsed", () => {
    const c = new SpellCastController();
    c.tryBeginCast("fireball");
    const done = c.updateChannel(1200, 0, 0);
    expect(done.type).toBe("completed");
    if (done.type === "completed") expect(done.spellId).toBe("fireball");
  });

  it("casts instant nova without channeling", () => {
    const c = new SpellCastController();
    const def = c.tryBeginCast("nova");
    expect(def).not.toBe(false);
    expect(def).not.toBe("channel");
    expect(c.isChanneling()).toBe(false);
  });
});