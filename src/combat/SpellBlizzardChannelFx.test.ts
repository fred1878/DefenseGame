import { afterEach, describe, expect, it, vi } from "vitest";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import { asScene, fakeScene } from "../test/fakeScene";
import { SpellBlizzardChannelFx } from "./SpellBlizzardChannelFx";

const KEY = SpellBlizzardChannelFx.defaultTextureKey();

describe("SpellBlizzardChannelFx", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the MobileRPG blizzard slice by default", () => {
    expect(KEY).toBe(COMBAT_FX_TEXTURE.spellBlizzard);
  });

  it("spawns nothing when the texture is missing", () => {
    const scene = fakeScene();
    new SpellBlizzardChannelFx(asScene(scene)).start(0, 0, 200, KEY);
    expect(scene.created).toHaveLength(0);
  });

  it.each([
    [50, 8],
    [154, 11],
    [1000, 14],
  ])("radius %i spawns %i drifting flakes inside the zone", (radius, count) => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const scene = fakeScene({ textures: [KEY] });
    new SpellBlizzardChannelFx(asScene(scene)).start(100, 100, radius, KEY);
    const flakes = scene.made("image");
    expect(flakes).toHaveLength(count);
    for (const f of flakes) {
      const [x, y] = f.args as [number, number];
      expect(Math.hypot(x - 100, y - 100)).toBeLessThanOrEqual(radius * 0.92 + 1e-9);
      const [w] = f.last("setDisplaySize") as [number];
      expect(w).toBeGreaterThanOrEqual(44);
      expect(w).toBeLessThanOrEqual(72);
    }
    expect(scene.tweenConfigs).toHaveLength(count);
    expect(scene.tweenConfigs.every((t) => t.repeat === -1 && t.yoyo)).toBe(true);
  });

  it("restarting or stopping removes the previous flakes and tweens", () => {
    const scene = fakeScene({ textures: [KEY] });
    const fx = new SpellBlizzardChannelFx(asScene(scene));
    fx.start(0, 0, 50, KEY);
    const first = scene.made("image");
    fx.start(0, 0, 50, KEY);
    expect(first.every((f) => f.destroyed)).toBe(true);
    const second = scene.made("image").slice(first.length);
    fx.destroy();
    expect(second.every((f) => f.destroyed)).toBe(true);
    const tweenObjs = scene.tweens.add.mock.results.map(
      (r) => r.value as { callsTo(m: string): unknown[] },
    );
    expect(tweenObjs.every((t) => t.callsTo("stop").length === 1)).toBe(true);
  });
});
