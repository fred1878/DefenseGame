import { describe, expect, it } from "vitest";
import {
  isSpellOnDefenseBar,
  normalizeBarSlots,
  toggleSpellOnDefenseBar,
} from "./spellBarSortSlots";

describe("toggleSpellOnDefenseBar", () => {
  it("adds to the first empty slot", () => {
    const slots = ["", "fireball", "", "", "", "", "", ""];
    expect(toggleSpellOnDefenseBar(slots, "heal")).toEqual([
      "heal",
      "fireball",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("removes when the spell is already on the bar", () => {
    const slots = ["heal", "fireball", "", "", "", "", "", ""];
    expect(toggleSpellOnDefenseBar(slots, "heal")).toEqual([
      "",
      "fireball",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("does not add when the bar is full", () => {
    const full = [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ] as const;
    expect(toggleSpellOnDefenseBar(full, "heal")).toEqual([...full]);
  });

  it("normalizes short slot arrays", () => {
    expect(normalizeBarSlots(["nova"])).toHaveLength(8);
    expect(normalizeBarSlots(["nova"])[0]).toBe("nova");
    expect(normalizeBarSlots(["nova"])[1]).toBe("");
  });
});

describe("isSpellOnDefenseBar", () => {
  it("reflects membership", () => {
    expect(isSpellOnDefenseBar(["heal", ""], "heal")).toBe(true);
    expect(isSpellOnDefenseBar(["heal", ""], "nova")).toBe(false);
  });
});