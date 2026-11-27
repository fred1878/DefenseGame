import Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { PLAYER_TEXTURE, SPELL_FX_ASSETS } from "../content/assets";
import {
  DEBUG_WORLD_TEXTURE_FILTER_KEY,
  getDebugWorldTextureFilter,
  installNearestTextureDefault,
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

describe("installNearestTextureDefault", () => {
  function setup(store: Record<string, unknown> = {}) {
    let handler: ((key: string, tex: unknown) => void) | null = null;
    const game = {
      registry: fakeRegistry(store),
      textures: {
        on: (event: string, fn: (key: string, tex: unknown) => void) => {
          expect(event).toBe("addtexture");
          handler = fn;
        },
      },
    } as unknown as Phaser.Game;
    installNearestTextureDefault(game);
    const add = (key: string) => {
      const calls: number[] = [];
      handler!(key, { setFilter: (m: number) => calls.push(m) });
      return calls;
    };
    return add;
  }

  it("starts every added texture NEAREST", () => {
    const add = setup();
    expect(add("some_new_sheet")).toEqual([Phaser.Textures.FilterMode.NEAREST]);
  });

  it("leaves vector talent icons on the renderer default", () => {
    const add = setup();
    expect(add("talent_icon_star")).toEqual([]);
  });

  it("follows the debug linear filter mode", () => {
    const add = setup({ [DEBUG_WORLD_TEXTURE_FILTER_KEY]: "linear" });
    expect(add("some_new_sheet")).toEqual([Phaser.Textures.FilterMode.LINEAR]);
  });
});
