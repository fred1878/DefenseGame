import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { meleeSwipeRotation } from "../combat/MeleeSwipeFx";
import {
  MELEE_FX_ANIM,
  MELEE_FX_ASSETS,
  enemyMeleeFxRotation,
  enemyMeleeFxSpec,
  registerMeleeFxAnimations,
} from "./meleeFxAssets";

describe("registerMeleeFxAnimations", () => {
  it("registers all melee pack animation keys when textures exist", () => {
    const created: string[] = [];
    const scene = {
      textures: {
        exists: (key: string) =>
          MELEE_FX_ASSETS.some((entry) => entry.key === key),
      },
      anims: {
        exists: (key: string) => created.includes(key),
        create: (cfg: { key: string }) => {
          created.push(cfg.key);
        },
        generateFrameNumbers: vi.fn(() => []),
      },
    } as unknown as Phaser.Scene;

    registerMeleeFxAnimations(scene);

    expect(created).toEqual(
      expect.arrayContaining(Object.values(MELEE_FX_ANIM)),
    );
    expect(created).toHaveLength(Object.keys(MELEE_FX_ANIM).length);
  });
});

describe("enemyMeleeFxSpec", () => {
  it("maps melee enemies to a clip without touching balance JSON", () => {
    expect(enemyMeleeFxSpec("grunt")?.animKey).toBe(MELEE_FX_ANIM.grunt);
    expect(enemyMeleeFxSpec("skirmisher")?.textureKey).toBe("fx_melee_skirmisher");
    expect(enemyMeleeFxSpec("sentry_archer")).toBeUndefined();
  });
});

describe("enemyMeleeFxRotation", () => {
  it("uses eastAtZero offset for PVFX so left attacks differ from slash-arc", () => {
    const spec = enemyMeleeFxSpec("skirmisher");
    expect(spec).toBeDefined();
    const facingLeft = Math.PI;
    const pvfxRot = enemyMeleeFxRotation(facingLeft, spec!);
    const slashRot = meleeSwipeRotation(facingLeft);
    expect(pvfxRot).toBeCloseTo(facingLeft);
    expect(slashRot).toBeCloseTo(facingLeft + Math.PI);
    expect(pvfxRot).not.toBeCloseTo(slashRot);
  });

  it("tracks facing for eastAtZero clips", () => {
    const spec = enemyMeleeFxSpec("bruiser")!;
    for (const facing of [0, Math.PI / 2, Math.PI]) {
      expect(enemyMeleeFxRotation(facing, spec)).toBeCloseTo(facing);
    }
  });
});