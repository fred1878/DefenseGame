import { describe, expect, it } from "vitest";
import { spellById } from "../../content/spells";
import { defaultRawData, loadSimData } from "./simData";
import {
  autoCastOrder,
  elementBar,
  fillerDps,
  isFillerSpell,
} from "./spellBars";

loadSimData(defaultRawData());

const SAVE = [
  "fire_nova",
  "arc_bomb",
  "lightning_bolt",
  "water_bolt",
  "fire_bolt",
  "ice_bolt",
  "heal",
  "flash_heal",
];

describe("spell bars", () => {
  it("treats no-cooldown damage spells as fillers", () => {
    expect(isFillerSpell(spellById("fire_bolt")!)).toBe(true);
    expect(isFillerSpell(spellById("ice_bolt")!)).toBe(true);
    expect(isFillerSpell(spellById("water_bolt")!)).toBe(true);
    expect(isFillerSpell(spellById("lightning_bolt")!)).toBe(false);
    // Blizzard's 1.5 s cooldown runs out during its own 4 s channel.
    expect(isFillerSpell(spellById("blizzard")!)).toBe(true);
    expect(isFillerSpell(spellById("cone_of_fire")!)).toBe(false);
    expect(isFillerSpell(spellById("heal")!)).toBe(false);
    expect(isFillerSpell(spellById("frost_nova")!)).toBe(false);
    // Fire bolt: 55 damage per 800 ms cast.
    expect(fillerDps(spellById("fire_bolt")!)).toBeCloseTo(68.75);
  });

  it("orders cooldown spells and heals by cooldown, then one filler", () => {
    expect(autoCastOrder(SAVE)).toEqual([
      "fire_nova",
      "heal",
      "arc_bomb",
      "flash_heal",
      "lightning_bolt",
      "fire_bolt",
    ]);
    expect(autoCastOrder([...SAVE, "", "fire_nova"], "ice_bolt").at(-1)).toBe(
      "ice_bolt",
    );
    expect(autoCastOrder(["frost_nova", "ice_bolt"])).toEqual([
      "frost_nova",
      "ice_bolt",
    ]);
    expect(autoCastOrder([])).toEqual([]);
  });

  it("builds legal element bars with heals and a fitting filler", () => {
    // ice_wall is not pool-selectable yet (implementation phase 5).
    const frostLead = ["frost_nova", "deep_freeze", "cone_of_cold"];
    const filled = ["fire_nova", "heal", "arc_bomb", "flash_heal"];
    expect(elementBar(SAVE, "frost", 8)).toEqual([
      ...frostLead,
      ...filled,
      "blizzard",
    ]);
    expect(elementBar(SAVE, "frost-bolt", 8)).toEqual([
      ...frostLead,
      ...filled,
      "ice_bolt",
    ]);
    expect(elementBar(SAVE, "lightning", 8)).toEqual([
      "chain_lightning",
      "lightning_bolt",
      ...filled,
      "fire_bolt",
    ]);
    // Too few slots: the element spells come first.
    expect(elementBar(["ice_bolt"], "frost", 4)).toEqual([
      ...frostLead,
      "blizzard",
    ]);
    expect(elementBar([], "lightning", 8)).toEqual([
      "chain_lightning",
      "lightning_bolt",
      "heal",
      "flash_heal",
    ]);
  });
});
