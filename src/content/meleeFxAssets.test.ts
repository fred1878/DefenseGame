import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { meleeSwipeRotation } from "../combat/MeleeSwipeFx";
import {
  MELEE_FX_ANIM,
  MELEE_FX_ASSETS,
  enemyMeleeFxFlipX,
  enemyMeleeFxRotation,
  enemyMeleeFxSpec,
  enemyMeleeFxStrikeAim,
  enemyMeleeFxTransform,
  meleeFxAnimDurationMs,
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
    expect(enemyMeleeFxSpec("skirmisher")?.textureKey).toBe(
      "fx_melee_skirmisher",
    );
    expect(enemyMeleeFxSpec("sentry_archer")).toBeUndefined();
  });
});

describe("enemyMeleeFxTransform", () => {
  it("flips west-half attacks for eastAtZero PVFX", () => {
    const spec = enemyMeleeFxSpec("skirmisher")!;
    const east = enemyMeleeFxTransform(0, spec);
    expect(east.flipX).toBe(false);
    expect(east.rotation).toBeCloseTo(0);
    const west = enemyMeleeFxTransform(Math.PI, spec);
    expect(west.flipX).toBe(true);
    expect(west.rotation).toBeCloseTo(0);
    expect(enemyMeleeFxFlipX(Math.PI, spec)).toBe(true);
    expect(enemyMeleeFxFlipX(0, spec)).toBe(false);
  });

  it("grunt slashTopBiasRight aligns strike to facing without flipX", () => {
    const spec = enemyMeleeFxSpec("grunt")!;
    expect(spec.animFacing).toBe("slashTopBiasRight");
    const facings = [
      0,
      Math.PI / 4,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 4,
      -Math.PI / 2,
      (-3 * Math.PI) / 4,
      (3 * Math.PI) / 4,
    ];
    for (const facing of facings) {
      const pose = enemyMeleeFxTransform(facing, spec);
      expect(pose.flipX).toBe(false);
      const aim = enemyMeleeFxStrikeAim(facing, spec);
      expect(aim).toBeCloseTo(facing, 4);
    }
  });

  it("keeps slashArcV2 rotation-only (no flip)", () => {
    const spec = enemyMeleeFxSpec("skirmisher")!;
    const slashSpec = {
      ...spec,
      animFacing: "slashArcV2" as const,
      rotationOffsetRad: Math.PI,
    };
    const west = enemyMeleeFxTransform(Math.PI, slashSpec);
    expect(west.flipX).toBe(false);
    expect(west.rotation).toBeCloseTo(meleeSwipeRotation(Math.PI));
  });

  it("meleeFxAnimDurationMs matches frameCount/frameRate", () => {
    expect(meleeFxAnimDurationMs("grunt")).toBeCloseTo(750);
    expect(meleeFxAnimDurationMs("skirmisher")).toBeCloseTo(600);
  });

  it("eastAtZero left vs right flip differs at same |facing|", () => {
    const spec = enemyMeleeFxSpec("bruiser")!;
    const right = enemyMeleeFxTransform(0, spec);
    const left = enemyMeleeFxTransform(Math.PI, spec);
    expect(right.flipX).not.toBe(left.flipX);
    const slashRot = meleeSwipeRotation(Math.PI);
    expect(enemyMeleeFxRotation(Math.PI, spec)).not.toBeCloseTo(slashRot);
  });
});
