import { describe, expect, it, vi } from "vitest";
import {
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";
import { asScene, fakeScene } from "../test/fakeScene";
import {
  FLAMESTRIKE_GROUND_FLAMES_COUNT,
  FLAMESTRIKE_PILLAR_COUNT,
  playFlamestrikeFirePillarBurst,
  scatterPointsInDisk,
  spawnFlamestrikeGroundFlamesLinger,
} from "./FlamestrikePvfx";

describe("FlamestrikePvfx", () => {
  it("scatters points inside the blast disk deterministically", () => {
    const pts = scatterPointsInDisk(100, 50, 80, 3, 1);
    expect(pts).toHaveLength(3);
    for (const p of pts) {
      expect(Math.hypot(p.x - 100, p.y - 50)).toBeLessThanOrEqual(80 * 0.86);
      expect(Math.hypot(p.x - 100, p.y - 50)).toBeGreaterThan(0);
    }
  });

  it("spawns pillar one-shots on impact", () => {
    const scene = fakeScene({
      textures: PVFX_FX_ASSETS.map((a) => a.key),
      anims: Object.values(PVFX_ANIM),
    });
    playFlamestrikeFirePillarBurst(asScene(scene), 0, 0, 100);
    expect(scene.made("sprite")).toHaveLength(FLAMESTRIKE_PILLAR_COUNT);
    expect(scene.made("sprite")[0]!.args[2]).toBe(PVFX_TEXTURE.firePillar);
  });

  it("spawns looping ground flames and cleans up on destroy", () => {
    const scene = fakeScene({
      textures: PVFX_FX_ASSETS.map((a) => a.key),
      anims: Object.values(PVFX_ANIM),
    });
    const register = vi.fn();
    const handle = spawnFlamestrikeGroundFlamesLinger(
      asScene(scene),
      10,
      20,
      90,
      register,
    );
    expect(scene.made("sprite")).toHaveLength(FLAMESTRIKE_GROUND_FLAMES_COUNT);
    expect(register).toHaveBeenCalledTimes(FLAMESTRIKE_GROUND_FLAMES_COUNT);
    handle.destroy();
    for (const go of scene.created) {
      expect(go.destroyed).toBe(true);
    }
  });
});
