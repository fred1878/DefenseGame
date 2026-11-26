import { describe, expect, it } from "vitest";
import {
  autoCastFlagsForSlots,
  normalizeAutoCastSpellIds,
  pruneAutoCastSpellIdsForSlots,
  toggleAutoCastSpellId,
} from "./spellBarAutoCast";

describe("spellBarAutoCast", () => {
  it("migrates legacy slot-index flags to spell ids", () => {
    const slots = ["fire_bolt", "meteor", "", "", "", "", "", ""];
    const ids = normalizeAutoCastSpellIds(slots, {
      autoCast: [true, true, false, false, false, false, false, false],
    });
    expect(ids).toEqual(expect.arrayContaining(["fire_bolt", "meteor"]));
  });

  it("auto-cast follows spell id after slot reorder", () => {
    const auto = ["meteor"];
    const slotsBefore = ["meteor", "", "", "", "", "", "", ""];
    let slots = [...slotsBefore];
    expect(autoCastFlagsForSlots(slots, auto)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);

    slots = ["", "meteor", "", "", "", "", "", ""];
    expect(autoCastFlagsForSlots(slots, auto)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);

    slots = ["heal", "", "", "", "", "", "", ""];
    expect(autoCastFlagsForSlots(slots, auto)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("pruneAutoCastSpellIdsForSlots drops ids not on the bar", () => {
    const slots = ["heal", "", "", "", "", "", "", ""];
    expect(
      pruneAutoCastSpellIdsForSlots(["heal", "meteor", "fire_bolt"], slots),
    ).toEqual(["heal"]);
    expect(
      pruneAutoCastSpellIdsForSlots(
        ["meteor"],
        ["", "", "", "", "", "", "", ""],
      ),
    ).toEqual([]);
  });

  it("swap does not give the new spell auto-cast from the slot", () => {
    const auto = toggleAutoCastSpellId([], "meteor");
    expect(auto).toEqual(["meteor"]);

    const slotsAfterSwap = ["heal", "", "", "", "", "", "", ""];
    expect(autoCastFlagsForSlots(slotsAfterSwap, auto)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("spellBarAutoCast leftover branches", () => {
  it("drops blank, duplicate, and unknown ids when deduping", () => {
    expect(
      normalizeAutoCastSpellIds(["fire_bolt"], {
        autoCastSpellIds: ["fire_bolt", "fire_bolt", "", "not_a_spell"],
      }),
    ).toEqual(["fire_bolt"]);
  });

  it("returns the default list when legacy flags are missing", () => {
    expect(normalizeAutoCastSpellIds(["fire_bolt"])).toEqual([]);
    expect(normalizeAutoCastSpellIds(["fire_bolt"], { autoCast: [] })).toEqual(
      [],
    );
  });

  it("skips a true legacy flag whose slot is empty", () => {
    const ids = normalizeAutoCastSpellIds(["", "meteor"], {
      autoCast: [true, true],
    });
    expect(ids).toEqual(["meteor"]);
  });

  it("toggles off an existing id and ignores a blank or unknown id", () => {
    expect(toggleAutoCastSpellId(["meteor"], "meteor")).toEqual([]);
    expect(toggleAutoCastSpellId(["meteor"], "")).toEqual(["meteor"]);
    expect(toggleAutoCastSpellId(["meteor"], "not_a_spell")).toEqual([
      "meteor",
    ]);
  });
});
