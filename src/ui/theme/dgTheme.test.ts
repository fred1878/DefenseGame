import { describe, expect, it } from "vitest";
import { DG_THEME, hexToInt, themeInt } from "./dgTheme";

describe("dgTheme", () => {
  it("has the 27 Figma DG Theme colours", () => {
    expect(Object.keys(DG_THEME)).toHaveLength(27);
    for (const v of Object.values(DG_THEME))
      expect(v).toMatch(/^#[0-9A-F]{6}$/);
    // Neutral buttons (e.g. Reset) use #3A322B, not black.
    expect(DG_THEME.buttonNeutral).toBe("#3A322B");
    expect(DG_THEME.borderSteel).toBe("#6B625A");
  });

  it("converts hex colours to Phaser ints", () => {
    expect(hexToInt("#D4A64A")).toBe(0xd4a64a);
    expect(hexToInt("ffffffcc")).toBe(0xffffff);
    expect(hexToInt("#zz")).toBe(0xffffff);
    expect(themeInt("accentCrimson")).toBe(0x9f1d2b);
  });
});
