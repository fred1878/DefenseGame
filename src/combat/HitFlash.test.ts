import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeAll } from "vitest";
import Phaser from "phaser";
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
  const sprite = {
    getData: vi.fn((key: string) => data.get(key)),
    setData: vi.fn((key: string, value: unknown) => {
      data.set(key, value);
    }),
    setTint: vi.fn(() => sprite),
    setTintMode: vi.fn(() => sprite),
    setAlpha: vi.fn(),
    clearTint: vi.fn(),
    _data: data,
  };
  return sprite;
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
    expect(hitFlashTintFor("lightning")).toBe(16761446);
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
    flashSpriteTint(
      scene,
      sprite as unknown as Phaser.GameObjects.Sprite,
      "physical",
    );
    expect(sprite.setTint).toHaveBeenCalledWith(16777215);
    expect(sprite.setTintMode).toHaveBeenCalledWith(Phaser.TintModes.FILL);
    expect(sprite.setTintMode).not.toHaveBeenCalledWith(
      Phaser.TintModes.MULTIPLY,
    );
    expect(sprite.setAlpha).toHaveBeenCalledWith(1);
  });

  it("applies multiply tint, color lerp, and alpha at peak for elemental flavors", () => {
    const sprite = mockFlashSprite();
    const scene = mockFlashScene();
    flashSpriteTint(
      scene,
      sprite as unknown as Phaser.GameObjects.Sprite,
      "water",
    );
    expect(sprite.setTint).toHaveBeenCalledWith(7254992);
    expect(sprite.setTintMode).toHaveBeenCalledWith(Phaser.TintModes.MULTIPLY);
    expect(sprite.setTintMode).not.toHaveBeenCalledWith(Phaser.TintModes.FILL);
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

  it("reapplies nothing without a flavor and clears a zero-strength flash", () => {
    const blank = mockFlashSprite();
    reapplySpriteHitFlashIfActive(
      blank as unknown as Phaser.GameObjects.Sprite,
    );
    expect(blank.setTint).not.toHaveBeenCalled();

    const fading = mockFlashSprite();
    fading._data.set("hitFlashFlavor", "fire");
    fading._data.set("hitFlashStrength", 0);
    reapplySpriteHitFlashIfActive(
      fading as unknown as Phaser.GameObjects.Sprite,
    );
    expect(fading.clearTint).toHaveBeenCalled();

    const full = mockFlashSprite();
    full._data.set("hitFlashFlavor", "physical");
    reapplySpriteHitFlashIfActive(full as unknown as Phaser.GameObjects.Sprite);
    expect(full.setTint).toHaveBeenCalled();
  });
});

describe("HitFlash tween callbacks", () => {
  it("updates strength mid-flash and clears tint when the tween ends", () => {
    const sprite = mockFlashSprite();
    let cfg:
      | {
          targets: { strength: number };
          onUpdate: () => void;
          onComplete: () => void;
        }
      | undefined;
    const scene = {
      tweens: {
        add: vi.fn((c: typeof cfg) => {
          cfg = c;
          return { stop: vi.fn() };
        }),
      },
    } as unknown as Phaser.Scene;
    flashSpriteTint(
      scene,
      sprite as unknown as Phaser.GameObjects.Sprite,
      "fire",
    );
    if (!cfg) throw new Error("expected a tween");
    cfg.targets.strength = 0.4;
    cfg.onUpdate();
    expect(sprite.setData).toHaveBeenCalledWith("hitFlashStrength", 0.4);
    cfg.onComplete();
    expect(sprite.clearTint).toHaveBeenCalled();
    expect(sprite.setAlpha).toHaveBeenCalledWith(1);
    expect(sprite.setData).toHaveBeenCalledWith("hitFlashTimer", undefined);
    expect(sprite.setData).toHaveBeenCalledWith("hitFlashFlavor", undefined);
    expect(sprite.setData).toHaveBeenCalledWith("hitFlashStrength", undefined);
  });
});

describe("HitFlash leftover flavor flags", () => {
  it("skips alpha and color fades when those flags are off", () => {
    const raw = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "public/data/hit-flash.json"),
        "utf8",
      ),
    );
    const cfg = normalizeHitFlash(raw);
    const previous = normalizeHitFlash(raw);
    cfg.flavors.fire = {
      ...cfg.flavors.fire!,
      tint: 0xff0000,
      mode: "multiply",
      peakAlpha: 0.5,
      alphaFade: false,
      colorFade: false,
    };
    try {
      applyHitFlashConfig(cfg);
      const sprite = mockFlashSprite();
      sprite._data.set("hitFlashFlavor", "fire");
      sprite._data.set("hitFlashStrength", 0.5);
      reapplySpriteHitFlashIfActive(
        sprite as unknown as Phaser.GameObjects.Sprite,
      );
      expect(sprite.setAlpha).toHaveBeenCalledWith(1);
      expect(sprite.setTint).toHaveBeenCalledWith(0xff0000);
    } finally {
      applyHitFlashConfig(previous);
    }
  });
});
