import { describe, expect, it } from "vitest";
import {
  DEFENSE_ASSETS_READY_KEY,
  ensureNightReady,
  ensureTownReachableReady,
  isNightReady,
  isTownReachableReady,
  TOWN_FLUFF_READY_KEY,
} from "./GameAssetLoader";
import type { DataStore } from "../../core/DataStore";

function mockGame(
  registry: Record<string, unknown>,
  scenes: { defense?: boolean; debugMenu?: boolean },
) {
  return {
    registry: {
      get: (k: string) => registry[k],
      set: (k: string, v: unknown) => {
        registry[k] = v;
      },
    },
    scene: {
      getScene: (key: string) => {
        if (key === "Defense" && scenes.defense) return {};
        if (key === "DebugMenu" && scenes.debugMenu) return {};
        return null;
      },
    },
  } as unknown as Phaser.Game;
}

function mockScene(game: Phaser.Game) {
  return { game } as unknown as Phaser.Scene;
}

describe("isNightReady", () => {
  it("is false until fluff, defense assets, data, and Defense scene are ready", () => {
    const registry: Record<string, unknown> = {};
    const store = { defenseDataReady: false } as DataStore;
    const game = mockGame(registry, {});
    expect(isNightReady(game, store)).toBe(false);

    registry[TOWN_FLUFF_READY_KEY] = true;
    registry[DEFENSE_ASSETS_READY_KEY] = true;
    store.defenseDataReady = true;
    expect(isNightReady(game, store)).toBe(false);

    const gameReady = mockGame(registry, { defense: true });
    expect(isNightReady(gameReady, store)).toBe(true);
  });

  it("isTownReachableReady also requires DebugMenu scene", () => {
    const registry: Record<string, unknown> = {
      [TOWN_FLUFF_READY_KEY]: true,
      [DEFENSE_ASSETS_READY_KEY]: true,
    };
    const store = { defenseDataReady: true } as DataStore;
    expect(
      isTownReachableReady(mockGame(registry, { defense: true }), store),
    ).toBe(false);
    expect(
      isTownReachableReady(
        mockGame(registry, { defense: true, debugMenu: true }),
        store,
      ),
    ).toBe(true);
  });
});

describe("ensureNightReady fast path", () => {
  it("resolves immediately when night is already ready", async () => {
    const registry: Record<string, unknown> = {
      [TOWN_FLUFF_READY_KEY]: true,
      [DEFENSE_ASSETS_READY_KEY]: true,
    };
    const store = { defenseDataReady: true } as DataStore;
    const game = mockGame(registry, { defense: true, debugMenu: true });
    const scene = mockScene(game);
    await expect(ensureNightReady(scene, store)).resolves.toBeUndefined();
    await expect(
      ensureTownReachableReady(scene, store),
    ).resolves.toBeUndefined();
  });
});
