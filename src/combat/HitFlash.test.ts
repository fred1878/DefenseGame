import { describe, expect, it, vi } from "vitest";
import {
  flashSpriteTint,
  HIT_FLASH_MS,
  hitFlashTintAtStrength,
  hitFlashTintFor,
} from "./HitFlash";

function mockFlashScene(): Phaser.Scene {
  return {
    tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
  } as unknown as Phaser.Scene;
}

function mockFlashSprite() {
  return {
    getData: vi.fn(() => undefined),
    setData: vi.fn(),
    setTint: vi.fn(),
    setTintFill: vi.fn(),
    setAlpha: vi.fn(),
    clearTint: vi.fn(),
  };
}

describe("HitFlash", () => {
  it("maps damage flavors to distinct tints", () => {
    expect(hitFlashTintFor("fire")).toBe(0xff2222);
    expect(hitFlashTintFor("physical")).toBe(0xffffff);
    expect(hitFlashTintFor("frost")).toBe(0x99ddff);
    expect(hitFlashTintFor("water")).toBe(0x6eb0d0);
    expect(hitFlashTintFor("water")).toBeLessThan(0x99ddff);
  });

  it("linearly eases multiply tints toward white as strength drops", () => {
    expect(hitFlashTintAtStrength("fire", 1)).toBe(0xff2222);
    expect(hitFlashTintAtStrength("fire", 0)).toBe(0xffffff);
    expect(hitFlashTintAtStrength("frost", 0.5)).toBe(0xcceeff);
    expect(hitFlashTintAtStrength("water", 1)).toBe(0x6eb0d0);
  });

  it("uses a modestly longer flash duration", () => {
    expect(HIT_FLASH_MS).toBeGreaterThanOrEqual(180);
    expect(HIT_FLASH_MS).toBeLessThanOrEqual(220);
  });

  it("applies tint fill for physical (visible on light sprites)", () => {
    const sprite = mockFlashSprite();
    const scene = mockFlashScene();
    flashSpriteTint(scene, sprite as unknown as Phaser.GameObjects.Sprite, "physical");
    expect(sprite.setTintFill).toHaveBeenCalledWith(0xffffff);
    expect(sprite.setTint).not.toHaveBeenCalled();
    expect(sprite.setAlpha).toHaveBeenCalledWith(1);
  });

  it("applies multiply tint for non-physical flavors", () => {
    const sprite = mockFlashSprite();
    const scene = mockFlashScene();
    flashSpriteTint(scene, sprite as unknown as Phaser.GameObjects.Sprite, "water");
    expect(sprite.setTint).toHaveBeenCalledWith(0x6eb0d0);
    expect(sprite.setTintFill).not.toHaveBeenCalled();
  });
});