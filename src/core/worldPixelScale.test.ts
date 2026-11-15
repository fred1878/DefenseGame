import { describe, expect, it, vi } from "vitest";
import { GAME } from "../config/game";
import {
  clampWorldPixelScale,
  cycleDebugWorldPixelScale,
  DEFAULT_WORLD_PIXEL_SCALE,
  getWorldPixelScale,
  scaledDefenseObstacles,
  setDebugWorldPixelScale,
  worldDisplayPx,
  worldScaleDebugLabel,
  worldScaleFactor,
  worldUnit,
  WORLD_PIXEL_SCALE_REGISTRY_KEY,
} from "./worldPixelScale";

function fakeRegistry(store: Record<string, unknown> = {}): Phaser.Data.DataManager {
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as Phaser.Data.DataManager;
}

describe("worldPixelScale", () => {
  it("defaults to 2× world art (today's baseline)", () => {
    expect(DEFAULT_WORLD_PIXEL_SCALE).toBe(2);
    expect(getWorldPixelScale(fakeRegistry())).toBe(2);
    expect(worldScaleFactor(fakeRegistry())).toBe(1);
  });

  it("scales display sizes vs 2× baseline", () => {
    const reg = fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 1 });
    expect(worldDisplayPx(64, reg)).toBe(32);
    expect(worldDisplayPx(64, fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 3 }))).toBe(
      96,
    );
    expect(worldUnit(42, reg)).toBe(21);
  });

  it("clamps debug scale to 1…cap", () => {
    expect(clampWorldPixelScale(0)).toBe(1);
    expect(clampWorldPixelScale(9)).toBe(GAME.renderResolutionCap);
  });

  it("scales obstacle colliders for nav", () => {
    const at1 = scaledDefenseObstacles(fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 1 }));
    const at2 = scaledDefenseObstacles(fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 2 }));
    expect(at1[0]!.w).toBeCloseTo(at2[0]!.w * 0.5, 5);
    expect(at1[0]!.h).toBeCloseTo(at2[0]!.h * 0.5, 5);
  });

  it("setDebugWorldPixelScale stores and restarts Defense when active", () => {
    const store: Record<string, unknown> = {};
    const restart = vi.fn();
    const game = {
      registry: fakeRegistry(store),
      events: { emit: vi.fn() },
      scene: {
        getScene: (key: string) =>
          key === "Defense"
            ? { scene: { isActive: () => true, restart } }
            : undefined,
      },
    } as unknown as Phaser.Game;

    expect(setDebugWorldPixelScale(game, 3)).toBe(3);
    expect(store[WORLD_PIXEL_SCALE_REGISTRY_KEY]).toBe(3);
    expect(restart).toHaveBeenCalled();
    expect(worldScaleDebugLabel(3)).toBe("World scale: 3×");
  });

  it("cycleDebugWorldPixelScale wraps at cap", () => {
    const store: Record<string, unknown> = {
      [WORLD_PIXEL_SCALE_REGISTRY_KEY]: GAME.renderResolutionCap,
    };
    const game = {
      registry: fakeRegistry(store),
      events: { emit: vi.fn() },
      scene: { getScene: () => ({ scene: { isActive: () => false, restart: vi.fn() } }) },
    } as unknown as Phaser.Game;
    expect(cycleDebugWorldPixelScale(game)).toBe(1);
  });
});