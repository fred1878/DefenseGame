import { describe, expect, it } from "vitest";
import { HIT_FLASH_MS, hitFlashTintFor } from "./HitFlash";

describe("HitFlash", () => {
  it("uses a visible default tint (not pure white)", () => {
    expect(hitFlashTintFor("default")).not.toBe(0xffffff);
    expect(hitFlashTintFor("default")).toBe(0xff8888);
  });

  it("maps damage flavors to distinct tints", () => {
    expect(hitFlashTintFor("fire")).toBe(0xff2222);
    expect(hitFlashTintFor("physical")).toBe(0xffffff);
    expect(hitFlashTintFor("frost")).toBe(0x99ddff);
  });

  it("uses a modestly longer flash duration", () => {
    expect(HIT_FLASH_MS).toBeGreaterThanOrEqual(180);
    expect(HIT_FLASH_MS).toBeLessThanOrEqual(220);
  });
});