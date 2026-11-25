import { describe, expect, it } from "vitest";
import { stickDeflectionInterruptsCast } from "./spellStickInterrupt";

describe("stickDeflectionInterruptsCast", () => {
  it("does not interrupt on neutral current stick (release)", () => {
    expect(stickDeflectionInterruptsCast(0, 0, 0.6, 0)).toBe(false);
  });

  it("interrupts when cast started neutral and stick deflects", () => {
    expect(stickDeflectionInterruptsCast(0.5, 0, 0, 0)).toBe(true);
  });

  it("does not interrupt for magnitude-only change on same bearing", () => {
    expect(stickDeflectionInterruptsCast(0.2, 0, 0.6, 0)).toBe(false);
  });

  it("interrupts when bearing changes beyond threshold", () => {
    expect(stickDeflectionInterruptsCast(0, 0.6, 0.6, 0)).toBe(true);
  });
});
