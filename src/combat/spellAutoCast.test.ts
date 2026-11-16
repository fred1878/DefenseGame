import { describe, expect, it } from "vitest";
import { pickAutoCastSpell } from "./spellAutoCast";

describe("pickAutoCastSpell", () => {
  const slots = ["fire_nova", "fire_bolt", "heal", "", "", "", "", ""];
  const none: string[] = [];

  it("returns null when nothing is auto-enabled", () => {
    expect(
      pickAutoCastSpell(slots, none, false, () => 0, false),
    ).toBeNull();
  });

  it("follows slot index priority among auto spell ids", () => {
    const auto = ["fire_bolt", "heal"];
    const pick = pickAutoCastSpell(slots, auto, false, () => 0, false);
    expect(pick?.spellId).toBe("fire_bolt");
    expect(pick?.slotIndex).toBe(1);
  });

  it("picks auto spell after reorder to a new slot index", () => {
    const reordered = ["", "heal", "fire_bolt", "", "", "", "", ""];
    const auto = ["fire_bolt"];
    const pick = pickAutoCastSpell(reordered, auto, false, () => 0, false);
    expect(pick?.spellId).toBe("fire_bolt");
    expect(pick?.slotIndex).toBe(2);
  });

  it("skips channeled spells while moving", () => {
    const channeledSlots = ["", "heal", "flamestrike", "", "", "", "", ""];
    const auto = ["heal", "flamestrike"];
    expect(
      pickAutoCastSpell(channeledSlots, auto, true, () => 0, false),
    ).toBeNull();
  });

  it("casts true instant spells while moving", () => {
    const auto = ["fire_nova"];
    const pick = pickAutoCastSpell(slots, auto, true, () => 0, false);
    expect(pick?.spellId).toBe("fire_nova");
  });

  it("skips cast-windup spells while moving", () => {
    const boltSlots = ["", "fire_bolt", "water_bolt", "", "", "", "", ""];
    const auto = ["fire_bolt", "water_bolt"];
    const pick = pickAutoCastSpell(boltSlots, auto, true, () => 0, false);
    expect(pick?.spellId).toBe("water_bolt");
  });

  it("skips all rooted spells while moving when only windups enabled", () => {
    const boltSlots = ["fire_bolt", "ice_bolt", "", "", "", "", "", ""];
    const auto = ["fire_bolt", "ice_bolt"];
    expect(pickAutoCastSpell(boltSlots, auto, true, () => 0, false)).toBeNull();
  });

  it("skips spells on cooldown", () => {
    const auto = ["fire_nova", "fire_bolt"];
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