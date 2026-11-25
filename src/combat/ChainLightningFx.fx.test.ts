import { describe, expect, it, vi } from "vitest";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import { asScene, fakeScene } from "../test/fakeScene";
import { showChainLightningFx } from "./ChainLightningFx";

describe("showChainLightningFx", () => {
  it("draws nothing without hops", () => {
    const scene = fakeScene();
    showChainLightningFx(asScene(scene), { x: 0, y: 0 }, []);
    expect(scene.created).toHaveLength(0);
  });

  it("strokes an edge and core bolt per hop segment from primary to last hop", () => {
    const scene = fakeScene();
    const register = vi.fn();
    showChainLightningFx(
      asScene(scene),
      { x: 0, y: 0 },
      [
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      register,
    );
    const [gfx] = scene.made("graphics");
    expect(register).toHaveBeenCalledWith(gfx);
    // 2 segments x (edge + core)
    expect(gfx!.callsTo("strokePath")).toHaveLength(4);
    const moves = gfx!.callsTo("moveTo");
    expect(moves[0]).toEqual([0, 0]);
    expect(moves[2]).toEqual([100, 0]);
    const lines = gfx!.callsTo("lineTo");
    // each polyline ends exactly at its hop
    expect(lines[4]).toEqual([100, 0]);
    expect(lines.at(-1)).toEqual([100, 100]);
    // no bolt texture -> only the graphics fades
    expect(scene.made("image")).toHaveLength(0);
    const tween = scene.tweenConfigs[0]!;
    expect(tween.targets).toEqual([gfx]);
    expect(tween.duration).toBe(200);
    tween.onComplete?.();
    expect(gfx!.destroyed).toBe(true);
  });

  it("adds a bolt flash on every hop when the texture is loaded and fades them together", () => {
    const scene = fakeScene({
      textures: [COMBAT_FX_TEXTURE.spellLightningBolt],
    });
    showChainLightningFx(asScene(scene), { x: 0, y: 0 }, [
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
    const bolts = scene.made("image");
    expect(bolts.map((b) => b.args.slice(0, 2))).toEqual([
      [10, 0],
      [20, 0],
    ]);
    const tween = scene.tweenConfigs[0]!;
    expect((tween.targets as unknown[]).length).toBe(3);
    tween.onComplete?.();
    expect(bolts.every((b) => b.destroyed)).toBe(true);
  });
});
