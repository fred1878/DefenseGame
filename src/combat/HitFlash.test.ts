import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { applyHitFlashConfig } from "../config/hitFlash";
import { normalizeHitFlash } from "../core/normalizeHitFlash";
import {
  flashSpriteTint,
  hitFlashDurationMs,
  hitFlashTintAtStrength,
  hitFlashTintFor,
  reapplySpriteHitFlashIfActive,
} from "./HitFlash";

function mockFlashScene(): Phaser.Scene {
  return {
    tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
  } as unknown as Phaser.Scene;
}

function mockFlashSprite() {
  const data = new Map<string, unknown>();
  return {
    getData: vi.fn((key: string) => data.get(key)),
    setData: vi.fn((key: string, value: unknown) => {
      data.set(key, value);
    }),
    setTint: vi.fn(),
    setTintFill: vi.fn(),
    setAlpha: vi.fn(),
    clearTint: vi.fn(),
    _data: data,
  };
}

beforeAll(() => {
  const raw = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "public/data/hit-flash.json"),
      "utf8",
    ),
  );
  applyHitFlashConfig(normalizeHitFlash(raw));
});

describe("HitFlash", () => {
  it("maps damage flavors to distinct tints from JSON", () => {
    expect(hitFlashTintFor("fire")).toBe(16724738);
    expect(hitFlashTintFor("physical")).toBe(16777215);
    expect(hitFlashTintFor("frost")).toBe(10075895);
    expect(hitFlashTintFor("water")).toBe(7254992);
    expect(hitFlashTintFor("water")).toBeLessThan(hitFlashTintFor("frost"));
  });

  it("linearly eases multiply tints toward white as strength drops", () => {
    expect(hitFlashTintAtStrength("fire", 1)).toBe(16724738);
    expect(hitFlashTintAtStrength("fire", 0)).toBe(16777215);
    expect(hitFlashTintAtStrength("frost", 0.5)).toBe(13426683);
    expect(hitFlashTintAtStrength("water", 1)).toBe(7254992);
  });

  it("uses authored flash duration from JSON", () => {
    expect(hitFlashDurationMs()).toBeGreaterThanOrEqual(180);
    expect(hitFlashDurationMs()).toBeLessThanOrEqual(220);
  });

  it("applies tint fill and alpha fade for physical at peak strength", () => {
    const sprite = mockFlashSprite();
    const scene = mockFlashScene();
    flashSpriteTint(scene, sprite as unknown as Phaser.GameObjects.Sprite, "physical");
    expect(sprite.setTintFill).toHaveBeenCalledWith(16777215);
    expect(sprite.setTint).not.toHaveBeenCalled();
    expect(sprite.setAlpha).toHaveBeenCalledWith(1);
  });

  it("applies multiply tint, color lerp, and alpha at peak for elemental flavors", () => {
    const sprite = mockFlashSprite();
    const scene = mockFlashScene();
    flashSpriteTint(scene, sprite as unknown as Phaser.GameObjects.Sprite, "water");
    expect(sprite.setTint).toHaveBeenCalledWith(7254992);
    expect(sprite.setTintFill).not.toHaveBeenCalled();
    expect(sprite.setAlpha).toHaveBeenCalledWith(1);
  });

  it("reapplies color lerp and alpha when flash is mid-tween", () => {
    const sprite = mockFlashSprite();
    sprite._data.set("hitFlashFlavor", "fire");
    sprite._data.set("hitFlashStrength", 0.5);
    reapplySpriteHitFlashIfActive(
      sprite as unknown as Phaser.GameObjects.Sprite,
    );
    expect(sprite.setTint).toHaveBeenCalledWith(
      hitFlashTintAtStrength("fire", 0.5),
    );
    expect(sprite.setAlpha).toHaveBeenCalledWith(0.5);
  });
});