import { describe, expect, it } from "vitest";
import { pickAutoCastSpell } from "./spellAutoCast";

describe("pickAutoCastSpell", () => {
  const slots = ["fire_nova", "fire_bolt", "heal", "", "", ""];
  const allOff = [false, false, false, false, false, false];

  it("returns null when nothing is auto-enabled", () => {
    expect(
      pickAutoCastSpell(slots, allOff, false, () => 0, false),
    ).toBeNull();
  });

  it("follows slot index priority", () => {
    const auto = [false, true, true, false, false, false];
    const pick = pickAutoCastSpell(slots, auto, false, () => 0, false);
    expect(pick?.spellId).toBe("fire_bolt");
    expect(pick?.slotIndex).toBe(1);
  });

  it("skips channeled spells while moving", () => {
    const channeledSlots = ["", "heal", "meteor", "", "", ""];
    const auto = [false, true, true, false, false, false];
    expect(
      pickAutoCastSpell(channeledSlots, auto, true, () => 0, false),
    ).toBeNull();
  });

  it("casts instant nova while moving", () => {
    const auto = [true, true, false, false, false, false];
    const pick = pickAutoCastSpell(slots, auto, true, () => 0, false);
    expect(pick?.spellId).toBe("fire_nova");
  });

  it("skips spells on cooldown", () => {
    const auto = [true, true, false, false, false, false];
    const pick = pickAutoCastSpell(
      slots,
      auto,
      false,
      (id) => (id === "fire_nova" ? 1000 : 0),
      false,
    );
    expect(pick?.spellId).toBe("fire_bolt");
  });
});