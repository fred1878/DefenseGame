import type Phaser from "phaser";
import PhaserNs from "phaser";
import { describe, expect, it, vi } from "vitest";
import { MELEE_FX_ASSETS, MELEE_FX_ANIM } from "../content/meleeFxAssets";
import { meleeSwipeRotation, showEnemyMeleeSwipe } from "./MeleeSwipeFx";

(PhaserNs as { Animations?: { Events: { ANIMATION_COMPLETE: string } } }).Animations =
  { Events: { ANIMATION_COMPLETE: "animationcomplete" } };

/** `slash-arc-v2` bisector is west when sprite rotation is 0. */
function slashAimDirection(spriteRotation: number): number {
  return spriteRotation + Math.PI;
}

function rotationAimsAlong(spriteRotation: number, facingRad: number): void {
  const aim = slashAimDirection(spriteRotation);
  const d = Math.hypot(
    Math.cos(aim) - Math.cos(facingRad),
    Math.sin(aim) - Math.sin(facingRad),
  );
  expect(d).toBeLessThan(1e-6);
}

describe("meleeSwipeRotation", () => {
  it("flips slash default west to match east attack facing", () => {
    expect(meleeSwipeRotation(0)).toBeCloseTo(Math.PI);
    rotationAimsAlong(meleeSwipeRotation(Math.PI), Math.PI);
    rotationAimsAlong(meleeSwipeRotation(0), 0);
  });

  it("tracks player atan2 facings", () => {
    for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      rotationAimsAlong(meleeSwipeRotation(facing), facing);
    }
  });
});

describe("showEnemyMeleeSwipe", () => {
  it("spawns PVFX when pack is loaded and uses authored vfx size", () => {
    const skirmisher = MELEE_FX_ASSETS.find((a) => a.key === "fx_melee_skirmisher")!;
    const scene = {
      registry: { get: () => 2 },
      textures: {
        exists: (key: string) => MELEE_FX_ASSETS.some((a) => a.key === key),
      },
      anims: {
        exists: (key: string) => key === MELEE_FX_ANIM.skirmisher,
      },
      add: {
        sprite: vi.fn(() => {
          const sprite: Record<string, unknown> = {
            anims: {} as { timeScale: number },
            setDisplaySize: vi.fn(function (this: typeof sprite) {
              return this;
            }),
            setOrigin: vi.fn(function (this: typeof sprite) {
              return this;
            }),
            setFlipX: vi.fn(function (this: typeof sprite) {
              return this;
            }),
            setRotation: vi.fn(function (this: typeof sprite) {
              return this;
            }),
            setDepth: vi.fn(function (this: typeof sprite) {
              return this;
            }),
            setAlpha: vi.fn(function (this: typeof sprite) {
              return this;
            }),
            play: vi.fn(function (this: typeof sprite) {
              return this;
            }),
            once: vi.fn(),
          };
          return sprite;
        }),
      },
    } as unknown as Phaser.Scene;

    showEnemyMeleeSwipe(
      scene,
      "skirmisher",
      10,
      20,
      0,
      undefined,
      80,
      { vfxDisplayW: 78, vfxDisplayH: 28, vfxOffsetWu: 26 },
    );

    const sprite = (scene.add.sprite as ReturnType<typeof vi.fn>).mock.results[0]!
      .value as { setDisplaySize: ReturnType<typeof vi.fn> };
    expect(sprite.setDisplaySize).toHaveBeenCalled();
    const [w, h] = sprite.setDisplaySize.mock.calls[0] as [number, number];
    expect(w).toBeGreaterThan(skirmisher.frameWidth);
    expect(h).toBeGreaterThan(0);
  });
});