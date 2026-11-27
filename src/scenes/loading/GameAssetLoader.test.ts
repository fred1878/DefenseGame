import { afterEach, describe, expect, it, vi } from "vitest";
import Phaser from "phaser";
import {
  DEFENSE_ASSETS_READY_KEY,
  TOWN_FLUFF_READY_KEY,
  TOWN_REACHABLE_READY_KEY,
  ensureDefenseAssetsLoaded,
  ensureTownFluffLoaded,
  ensureTownReachableReady,
  queueDefenseBootAssets,
  queueMinimalTownBootAssets,
  queueTownFluffAssets,
  runQueuedLoader,
} from "./GameAssetLoader";
import type { DataStore } from "../../core/data/DataStore";

function fakeLoader(listSize = 0) {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const loader = {
    setBaseURL: vi.fn(),
    image: vi.fn(),
    audio: vi.fn(),
    font: vi.fn(),
    spritesheet: vi.fn(),
    once: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
    }),
    list: { size: listSize },
    start: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners.get(event) ?? []) fn(...args);
    },
  };
  return loader;
}

function fakeScene(
  loader: ReturnType<typeof fakeLoader>,
  registry: Record<string, unknown> = {},
) {
  const textures = new Map<string, { setFilter: ReturnType<typeof vi.fn> }>();
  const game = {
    registry: {
      get: (key: string) => registry[key],
      set: (key: string, value: unknown) => {
        registry[key] = value;
      },
    },
    scene: {
      getScene: (key: string) => (registry[`scene:${key}`] ? {} : null),
      add: vi.fn(),
    },
  };
  const scene = {
    load: loader,
    game,
    textures: {
      exists: (key: string) => textures.has(key) || key === "player_s",
      get: (key: string) => {
        const existing = textures.get(key);
        if (existing) return existing;
        const created = { setFilter: vi.fn() };
        textures.set(key, created);
        return created;
      },
    },
    anims: {
      exists: () => false,
      create: vi.fn(),
      generateFrameNumbers: vi.fn(() => []),
    },
    texturesMap: textures,
  };
  return scene as unknown as Phaser.Scene & {
    load: ReturnType<typeof fakeLoader>;
    game: typeof game;
    texturesMap: typeof textures;
  };
}

describe("GameAssetLoader queues", () => {
  it("queues town boot, town fluff, and defense assets onto the loader", () => {
    const loader = fakeLoader();
    queueMinimalTownBootAssets(loader as never, "/");
    expect(loader.setBaseURL).toHaveBeenCalledWith("/");
    expect(loader.image.mock.calls.length).toBeGreaterThan(0);

    const fluff = fakeLoader();
    queueTownFluffAssets(fluff as never, "/cdn/");
    expect(fluff.setBaseURL).toHaveBeenCalledWith("/cdn/");
    expect(fluff.image.mock.calls.length).toBeGreaterThan(0);
    expect(fluff.audio.mock.calls.length).toBeGreaterThan(0);

    const env = import.meta.env as unknown as Record<string, unknown>;
    const prev = env.VITE_BUILD_ID;
    env.VITE_BUILD_ID = "rev123";
    const fluffRev = fakeLoader();
    queueTownFluffAssets(fluffRev as never, "/");
    expect(
      fluffRev.image.mock.calls.some((call) =>
        String(call[1]).includes("v=rev123"),
      ),
    ).toBe(true);
    env.VITE_BUILD_ID = prev;

    const defense = fakeLoader();
    queueDefenseBootAssets(defense as never, "/");
    expect(defense.image.mock.calls.length).toBeGreaterThan(0);
    expect(defense.spritesheet.mock.calls.length).toBeGreaterThan(0);
    expect(defense.font.mock.calls.length).toBeGreaterThan(0);
  });
});

describe("runQueuedLoader", () => {
  it("resolves immediately when the queue is empty", async () => {
    const loader = fakeLoader(0);
    const scene = fakeScene(loader);
    await runQueuedLoader(scene, () => undefined);
    expect(loader.start).not.toHaveBeenCalled();
  });

  it("starts the loader and resolves on COMPLETE", async () => {
    const loader = fakeLoader(3);
    const scene = fakeScene(loader);
    const pending = runQueuedLoader(scene, (queued) => {
      queued.image("k", "f.png");
    });
    expect(loader.start).toHaveBeenCalledOnce();
    loader.emit(Phaser.Loader.Events.COMPLETE);
    await pending;
  });

  it("rejects when a file fails to load", async () => {
    const loader = fakeLoader(1);
    const scene = fakeScene(loader);
    const pending = runQueuedLoader(scene, () => undefined);
    loader.emit(Phaser.Loader.Events.FILE_LOAD_ERROR, { key: "player_s" });
    await expect(pending).rejects.toThrow("Failed to load asset: player_s");
  });
});

describe("ensure asset loaders", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("returns immediately when registry flags are already set", async () => {
    const loader = fakeLoader(0);
    const scene = fakeScene(loader, {
      [TOWN_FLUFF_READY_KEY]: true,
      [DEFENSE_ASSETS_READY_KEY]: true,
    });
    await expect(ensureTownFluffLoaded(scene)).resolves.toBeUndefined();
    await expect(ensureDefenseAssetsLoaded(scene)).resolves.toBeUndefined();
    expect(loader.start).not.toHaveBeenCalled();
  });

  it("loads fluff and defense assets once and reuses the in-flight promise", async () => {
    const loader = fakeLoader(2);
    const scene = fakeScene(loader);
    const fluffA = ensureTownFluffLoaded(scene);
    const fluffB = ensureTownFluffLoaded(scene);
    expect(fluffA).toBe(fluffB);
    loader.emit(Phaser.Loader.Events.COMPLETE);
    await fluffA;
    expect(scene.game.registry.get(TOWN_FLUFF_READY_KEY)).toBe(true);

    const defenseLoader = fakeLoader(2);
    const defenseScene = fakeScene(defenseLoader);
    const defA = ensureDefenseAssetsLoaded(defenseScene);
    const defB = ensureDefenseAssetsLoaded(defenseScene);
    expect(defA).toBe(defB);
    defenseLoader.emit(Phaser.Loader.Events.COMPLETE);
    await defA;
    expect(defenseScene.game.registry.get(DEFENSE_ASSETS_READY_KEY)).toBe(true);
  });

  it("prefetching town-reachable ready loads remaining work and clears on error", async () => {
    const loader = fakeLoader(0);
    const registry: Record<string, unknown> = {};
    const scene = fakeScene(loader, registry);
    const store = {
      defenseDataReady: false,
      ensureDefenseDataLoaded: vi.fn(async () => {
        throw new Error("data failed");
      }),
    } as unknown as DataStore;

    const first = ensureTownReachableReady(scene, store);
    const second = ensureTownReachableReady(scene, store);
    expect(first).toBe(second);
    await expect(first).rejects.toThrow("data failed");
    expect(registry[TOWN_REACHABLE_READY_KEY]).toBeUndefined();

    // After a failure the promise is cleared so a later call can retry.
    (
      store.ensureDefenseDataLoaded as ReturnType<typeof vi.fn>
    ).mockResolvedValue(undefined);
    registry[TOWN_FLUFF_READY_KEY] = true;
    registry[DEFENSE_ASSETS_READY_KEY] = true;
    (store as { defenseDataReady: boolean }).defenseDataReady = true;
    registry["scene:Defense"] = true;
    registry["scene:DebugMenu"] = true;
    await expect(
      ensureTownReachableReady(scene, store),
    ).resolves.toBeUndefined();
  });
});
