import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  registerSmokeFxAnimations,
  SMOKE_FX_ANIM,
  SMOKE_FX_ASSETS,
} from "./smokeFxAssets";

describe("registerSmokeFxAnimations", () => {
  it("registers Smoke A charge animation when texture exists", () => {
    const created: string[] = [];
    const scene = {
      textures: {
        exists: (key: string) =>
          SMOKE_FX_ASSETS.some((entry) => entry.key === key),
      },
      anims: {
        exists: (key: string) => created.includes(key),
        create: (cfg: { key: string }) => {
          created.push(cfg.key);
        },
        generateFrameNumbers: vi.fn(() => []),
      },
    } as unknown as Phaser.Scene;

    registerSmokeFxAnimations(scene);

    expect(created).toEqual([SMOKE_FX_ANIM.chargeStart]);
  });
});