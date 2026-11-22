import { describe, expect, it, vi } from "vitest";
import { flashSpriteTint, HIT_FLASH_MS, hitFlashTintFor } from "./HitFlash";

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

  it("applies tint fill for physical (visible on light sprites)", () => {
    const setTint = vi.fn();
    const setTintFill = vi.fn();
    const sprite = {
      getData: vi.fn(() => undefined),
      setData: vi.fn(),
      setTint,
      setTintFill,
      clearTint: vi.fn(),
    };
    const scene = { time: { delayedCall: vi.fn(() => ({})) } };
    flashSpriteTint(
      scene as unknown as Phaser.Scene,
      sprite as unknown as Phaser.GameObjects.Sprite,
      "physical",
    );
    expect(setTintFill).toHaveBeenCalledWith(0xffffff);
    expect(setTint).not.toHaveBeenCalled();
  });

  it("applies multiply tint for non-physical flavors", () => {
    const setTint = vi.fn();
    const setTintFill = vi.fn();
    const sprite = {
      getData: vi.fn(() => undefined),
      setData: vi.fn(),
      setTint,
      setTintFill,
      clearTint: vi.fn(),
    };
    const scene = { time: { delayedCall: vi.fn(() => ({})) } };
    flashSpriteTint(
      scene as unknown as Phaser.Scene,
      sprite as unknown as Phaser.GameObjects.Sprite,
      "default",
    );
    expect(setTint).toHaveBeenCalledWith(0xff8888);
    expect(setTintFill).not.toHaveBeenCalled();
  });
});