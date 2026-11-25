import { afterEach, describe, expect, it, vi } from "vitest";
import Phaser from "phaser";
import {
  attachE2EGame,
  markE2EAssetsLoaded,
  seedE2EWindowStub,
} from "./installE2E";
import { getE2EState } from "./e2eGlobal";
import type { DefenseGameE2EApi } from "./e2eGlobal";

function windowStub(href = "http://localhost/?e2e=1") {
  const win: {
    location: { href: string };
    __DEFENSEGAME_E2E__?: unknown;
  } = { location: { href } };
  vi.stubGlobal("window", win);
  return win;
}

describe("installE2E", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not seed the hook when e2e is disabled or window is missing", () => {
    vi.stubEnv("VITE_E2E", "false");
    vi.stubGlobal("window", undefined);
    seedE2EWindowStub();
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
    seedE2EWindowStub();
    expect(
      (globalThis as { window: { __DEFENSEGAME_E2E__?: unknown } }).window
        .__DEFENSEGAME_E2E__,
    ).toBeUndefined();
  });

  it("seeds the window hook when e2e is enabled", () => {
    vi.stubEnv("VITE_E2E", "true");
    const win = windowStub();
    seedE2EWindowStub();
    expect(win.__DEFENSEGAME_E2E__).toMatchObject({
      ready: false,
      scene: "boot",
      api: null,
    });
  });

  it("is a no-op when attaching or marking assets without e2e", () => {
    vi.stubEnv("VITE_E2E", "false");
    vi.stubGlobal("window", undefined);
    attachE2EGame({} as Phaser.Game);
    markE2EAssetsLoaded({} as Phaser.Game);
  });

  it("publishes Town and Defense scene state and DOM targets", () => {
    vi.stubEnv("VITE_E2E", "true");
    windowStub();
    const listeners = new Map<string, Array<() => void>>();
    const defenseE2e = {
      isReady: vi.fn(() => true),
      playerPosition: vi.fn(() => ({ x: 5, y: 6 })),
      attackPhase: vi.fn(() => "idle"),
      projectileCount: vi.fn(() => 1),
      enemyCount: vi.fn(() => 2),
      isEndlessMode: vi.fn(() => false),
      endlessEnemyId: vi.fn(() => null),
      nightEnded: vi.fn(() => false),
      hasReturnButton: vi.fn(() => false),
      wallHp: vi.fn(() => 90),
      autoAttackEnabled: vi.fn(() => true),
      getUiTapTargets: vi.fn(() => ({ "combat-atk": { x: 1, y: 2 } })),
    };
    const defense = {
      scene: { isActive: (): boolean => true, key: "Defense" },
      e2e: defenseE2e,
    };
    const town = {
      scene: { isActive: (): boolean => true, key: "Town" },
      e2eGetUiTapTargets: vi.fn(() => ({ "start-night": { x: 3, y: 4 } })),
    };
    let activeKey = "Town";
    const game = {
      events: {
        on: vi.fn((event: string, fn: () => void) => {
          const list = listeners.get(event) ?? [];
          list.push(fn);
          listeners.set(event, list);
        }),
      },
      scene: {
        getScenes: vi.fn((_active?: boolean) => {
          if (activeKey === "Town") return [town];
          if (activeKey === "Defense") return [defense];
          return [{ scene: { isActive: (): boolean => true, key: "Boot" } }];
        }),
        getScene: vi.fn((key: string) => {
          if (key === "Defense") return defense;
          if (key === "Town") return town;
          return null;
        }),
        start: vi.fn(),
      },
      registry: { get: vi.fn(), set: vi.fn() },
      textures: { exists: vi.fn(() => false), get: vi.fn() },
      loop: { actualFps: 60, time: 0 },
    };

    attachE2EGame(game as unknown as Phaser.Game);
    expect(getE2EState().api).toBeTruthy();
    expect(getE2EState().scene).toBe("Town");
    expect(getE2EState().ready).toBe(true);
    expect(town.e2eGetUiTapTargets).toHaveBeenCalled();

    activeKey = "Defense";
    listeners.get(Phaser.Scenes.Events.CREATE)?.[0]?.();
    expect(getE2EState().scene).toBe("Defense");
    expect(getE2EState().player).toEqual({ x: 5, y: 6 });
    expect(getE2EState().flags.enemyCount).toBe(2);
    expect(getE2EState().flags.autoAttackOn).toBe(true);

    defenseE2e.isReady.mockReturnValue(false);
    listeners.get(Phaser.Scenes.Events.TRANSITION_COMPLETE)?.[0]?.();
    expect(getE2EState().ready).toBe(true);

    activeKey = "Boot";
    listeners.get(Phaser.Scenes.Events.TRANSITION_START)?.[0]?.();
    expect(getE2EState().scene).toBe("Boot");
    expect(getE2EState().ready).toBe(false);
  });

  it("marks combat FX assets loaded only when every key exists", () => {
    vi.stubEnv("VITE_E2E", "true");
    windowStub();
    const exists = vi.fn(() => false);
    markE2EAssetsLoaded({
      textures: { exists },
    } as unknown as Phaser.Game);
    expect(getE2EState().assetsLoaded).toBe(false);
    expect(String(getE2EState().flags.combatFxKeys)).toContain(",");

    exists.mockReturnValue(true);
    markE2EAssetsLoaded({
      textures: { exists },
    } as unknown as Phaser.Game);
    expect(getE2EState().assetsLoaded).toBe(true);
  });

  it("keeps a typed api shape after attach", () => {
    vi.stubEnv("VITE_E2E", "true");
    windowStub();
    const game = {
      events: { on: vi.fn() },
      scene: {
        getScenes: () => [],
        getScene: () => null,
        start: vi.fn(),
      },
      registry: { get: vi.fn(), set: vi.fn() },
      textures: { exists: () => false, get: vi.fn() },
      loop: { actualFps: 0, time: 0 },
    };
    attachE2EGame(game as unknown as Phaser.Game);
    const api = getE2EState().api as DefenseGameE2EApi;
    expect(typeof api.startNight).toBe("function");
  });
});
