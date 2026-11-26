import { describe, expect, it } from "vitest";
import { GROUND_TILE_TEXTURE } from "../content/assets";
import { asScene, fakeScene } from "../test/fakeScene";
import { buildGroundLayer } from "./buildGroundLayer";

describe("buildGroundLayer", () => {
  it("returns an empty container when the texture is missing", () => {
    const scene = fakeScene();
    const layer = buildGroundLayer(asScene(scene), 100, 80);
    expect(layer).toBeDefined();
    expect(scene.made("image")).toHaveLength(0);
  });

  it("tiles the field when the ground texture exists", () => {
    const scene = fakeScene({ textures: [GROUND_TILE_TEXTURE] });
    const layer = buildGroundLayer(asScene(scene), 64, 64);
    expect(layer).toBeDefined();
    expect(scene.made("image").length).toBeGreaterThan(0);
    const first = scene.made("image")[0];
    expect(first?.args[2]).toBe(GROUND_TILE_TEXTURE);
  });
});
