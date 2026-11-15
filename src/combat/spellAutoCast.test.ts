import { describe, expect, it } from "vitest";
import { pickAutoCastSpell } from "./spellAutoCast";

describe("pickAutoCastSpell", () => {
  const slots = ["nova", "fireball", "heal", "", "", ""];
  const allOff = [false, false, false, false, false, false];

  it("returns null when nothing is auto-enabled", () => {
    expect(
      pickAutoCastSpell(slots, allOff, false, () => 0, false),
    ).toBeNull();
  });

  it("follows slot index priority", () => {
    const auto = [false, true, true, false, false, false];
    const pick = pickAutoCastSpell(slots, auto, false, () => 0, false);
    expect(pick?.spellId).toBe("fireball");
    expect(pick?.slotIndex).toBe(1);
  });

  it("skips channeled spells while moving", () => {
    const auto = [false, true, true, false, false, false];
    expect(pickAutoCastSpell(slots, auto, true, () => 0, false)).toBeNull();
  });

  it("casts instant nova while moving", () => {
    const auto = [true, true, false, false, false, false];
    const pick = pickAutoCastSpell(slots, auto, true, () => 0, false);
    expect(pick?.spellId).toBe("nova");
  });

  it("skips spells on cooldown", () => {
    const auto = [true, true, false, false, false, false];
    const pick = pickAutoCastSpell(
      slots,
      auto,
      false,
      (id) => (id === "nova" ? 1000 : 0),
      false,
    );
    expect(pick?.spellId).toBe("fireball");
  });
});