import { describe, expect, it } from "vitest";
import { GROUND_DECOR_ASSETS } from "../content/assets";
import { asScene, fakeScene } from "../test/fakeScene";
import { buildGroundDecorLayer } from "./buildGroundDecorLayer";

describe("buildGroundDecorLayer", () => {
  it("returns empty decor when no textures are loaded", () => {
    const scene = fakeScene();
    const layer = buildGroundDecorLayer(asScene(scene), 80, 80, 42);
    expect(scene.made("image")).toHaveLength(0);
    expect(layer).toBeDefined();
  });

  it("places decor sprites when textures exist", () => {
    const keys = GROUND_DECOR_ASSETS.map((a) => a.key);
    const scene = fakeScene({ textures: keys });
    buildGroundDecorLayer(asScene(scene), 128, 128, 99);
    expect(scene.made("image").length).toBeGreaterThan(0);
  });
});
