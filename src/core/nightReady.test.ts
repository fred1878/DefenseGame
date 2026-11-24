import { describe, expect, it } from "vitest";
import {
  DEFENSE_ASSETS_READY_KEY,
  ensureNightReady,
  isNightReady,
  TOWN_FLUFF_READY_KEY,
} from "./GameAssetLoader";
import type { DataStore } from "./DataStore";

function mockGame(registry: Record<string, unknown>, hasDefenseScene: boolean) {
  return {
    registry: {
      get: (k: string) => registry[k],
      set: (k: string, v: unknown) => {
        registry[k] = v;
      },
    },
    scene: {
      getScene: (key: string) => (key === "Defense" && hasDefenseScene ? {} : null),
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
    const game = mockGame(registry, false);
    expect(isNightReady(game, store)).toBe(false);

    registry[TOWN_FLUFF_READY_KEY] = true;
    registry[DEFENSE_ASSETS_READY_KEY] = true;
    store.defenseDataReady = true;
    expect(isNightReady(game, store)).toBe(false);

    const gameReady = mockGame(registry, true);
    expect(isNightReady(gameReady, store)).toBe(true);
  });
});

describe("ensureNightReady fast path", () => {
  it("resolves immediately when night is already ready", async () => {
    const registry: Record<string, unknown> = {
      [TOWN_FLUFF_READY_KEY]: true,
      [DEFENSE_ASSETS_READY_KEY]: true,
    };
    const store = { defenseDataReady: true } as DataStore;
    const game = mockGame(registry, true);
    const scene = mockScene(game);
    await expect(ensureNightReady(scene, store)).resolves.toBeUndefined();
  });
});