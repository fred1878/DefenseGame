import { describe, expect, it } from "vitest";
import { hitFlashTintFor } from "./HitFlash";

describe("HitFlash", () => {
  it("uses a visible default tint (not pure white)", () => {
    expect(hitFlashTintFor("default")).not.toBe(0xffffff);
    expect(hitFlashTintFor("default")).toBe(0xffb8b8);
  });
});