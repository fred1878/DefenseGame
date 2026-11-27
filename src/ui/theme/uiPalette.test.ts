import { describe, expect, it } from "vitest";
import { PALETTE, PALETTE_CSS } from "./uiPalette";

describe("uiPalette", () => {
  it("int and css tables hold the same colours", () => {
    for (const [k, css] of Object.entries(PALETTE_CSS)) {
      expect(css).toMatch(/^#[0-9a-f]{6}$/);
      expect(PALETTE[k as keyof typeof PALETTE]).toBe(
        Number.parseInt(css.slice(1), 16),
      );
    }
  });

  it("keeps exact legacy values", () => {
    expect(PALETTE.zinc400).toBe(0xa1a1aa);
    expect(PALETTE.green700).toBe(0x15803d);
    expect(PALETTE_CSS.amber200).toBe("#fde68a");
  });
});
