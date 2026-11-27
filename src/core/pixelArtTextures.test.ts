import Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { PLAYER_TEXTURE, SPELL_FX_ASSETS } from "../content/assets";
import {
  getDebugWorldTextureFilter,
  HYBRID_LINEAR_TEXTURE_KEYS,
  isHybridLinearTextureKey,
  textureFilterForKey,
} from "./pixelArtTextures";

function fakeRegistry(store: Record<string, unknown> = {}) {
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as Phaser.Data.DataManager;
}

describe("pixelArtTextures filter debug", () => {
  it("defaults texture filter mode to nearest", () => {
    expect(getDebugWorldTextureFilter(fakeRegistry())).toBe("nearest");
  });

  it("classifies hybrid linear keys from spell/pvfx/holy/ice lists", () => {
    const spellKey = SPELL_FX_ASSETS[0]?.key;
    expect(spellKey).toBeDefined();
    expect(HYBRID_LINEAR_TEXTURE_KEYS).toContain(spellKey);
    expect(isHybridLinearTextureKey(spellKey!)).toBe(true);
    const playerKey = Object.values(PLAYER_TEXTURE)[0];
    expect(isHybridLinearTextureKey(playerKey!)).toBe(false);
  });

  it("maps filter modes per key", () => {
    const playerKey = Object.values(PLAYER_TEXTURE)[0]!;
    const fxKey = SPELL_FX_ASSETS[0]!.key;
    expect(textureFilterForKey(playerKey, "nearest")).toBe(
      Phaser.Textures.FilterMode.NEAREST,
    );
    expect(textureFilterForKey(playerKey, "linear")).toBe(
      Phaser.Textures.FilterMode.LINEAR,
    );
    expect(textureFilterForKey(fxKey, "hybrid")).toBe(
      Phaser.Textures.FilterMode.LINEAR,
    );
    expect(textureFilterForKey(playerKey, "hybrid")).toBe(
      Phaser.Textures.FilterMode.NEAREST,
    );
  });
});
