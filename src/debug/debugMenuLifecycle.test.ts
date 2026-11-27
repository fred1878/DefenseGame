import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEBUG_MENU_SCENE_KEY,
  launchDebugMenuFromHost,
  openDebugMenuFromHost,
  pauseForDebugMenu,
  resumeFromDebugMenu,
} from "./debugMenuLifecycle";

const ensureDebugMenuScene = vi.fn<(_game: Phaser.Game) => Promise<void>>(() =>
  Promise.resolve(),
);

vi.mock("../scenes/loading/lazyScenes", () => ({
  ensureDebugMenuScene: (game: Phaser.Game) => ensureDebugMenuScene(game),
}));

function mockScene(paused = false) {
  const isPaused = vi.fn(() => paused);
  const pause = vi.fn(() => {
    paused = true;
  });
  const resume = vi.fn(() => {
    paused = false;
  });
  const scene = {
    key: "Defense",
    scene: { key: "Defense", isPaused, pause, resume },
  } as unknown as Phaser.Scene;
  return { scene, isPaused, pause, resume, getPaused: () => paused };
}

describe("debugMenuLifecycle", () => {
  it("pauses the host scene once", () => {
    const { scene, pause, isPaused } = mockScene(false);
    pauseForDebugMenu(scene);
    expect(pause).toHaveBeenCalledWith("Defense");
    isPaused.mockReturnValue(true);
    pauseForDebugMenu(scene);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("resumes when paused", () => {
    const { scene, resume, isPaused } = mockScene(true);
    isPaused.mockReturnValue(true);
    resumeFromDebugMenu(scene);
    expect(resume).toHaveBeenCalledWith("Defense");
  });
});

function mockHostScene(debugActive = false) {
  let paused = false;
  const isPaused = vi.fn((key: string) => key === "Town" && paused);
  const pause = vi.fn(() => {
    paused = true;
  });
  const launch = vi.fn();
  const stop = vi.fn();
  const bringToTop = vi.fn();
  const isActive = vi.fn(() => debugActive);
  const get = vi.fn((key: string) =>
    key === DEBUG_MENU_SCENE_KEY ? { scene: { isActive } } : null,
  );
  const stack: { id: string; layer: string }[] = [];
  const host = {
    scene: {
      key: "Town",
      isPaused,
      pause,
      get,
      launch,
      stop,
      bringToTop,
    },
    game: {},
    registry: {
      get: vi.fn(() => stack),
      set: vi.fn(),
    },
    events: { emit: vi.fn() },
  } as unknown as Phaser.Scene;
  return { host, launch, stop, bringToTop, stack, pause };
}

describe("launchDebugMenuFromHost", () => {
  beforeEach(() => {
    ensureDebugMenuScene.mockClear();
  });

  it("launches DebugMenu, pauses host, and bringToTop", () => {
    const { host, launch, bringToTop, pause, stack } = mockHostScene(false);
    launchDebugMenuFromHost(host);
    expect(stack.some((t) => t.id === "debug-menu")).toBe(true);
    expect(pause).toHaveBeenCalledWith("Town");
    expect(launch).toHaveBeenCalledWith(DEBUG_MENU_SCENE_KEY);
    expect(bringToTop).toHaveBeenCalledWith(DEBUG_MENU_SCENE_KEY);
  });

  it("stops and relaunches DebugMenu when already active", () => {
    const { host, launch, stop, bringToTop } = mockHostScene(true);
    launchDebugMenuFromHost(host);
    expect(stop).toHaveBeenCalledWith(DEBUG_MENU_SCENE_KEY);
    expect(launch).toHaveBeenCalledWith(DEBUG_MENU_SCENE_KEY);
    expect(bringToTop).toHaveBeenCalledWith(DEBUG_MENU_SCENE_KEY);
  });

  it("openDebugMenuFromHost awaits ensureDebugMenuScene", async () => {
    const { host, bringToTop } = mockHostScene(false);
    openDebugMenuFromHost(host);
    await Promise.resolve();
    expect(ensureDebugMenuScene).toHaveBeenCalledWith(host.game);
    expect(bringToTop).toHaveBeenCalledWith(DEBUG_MENU_SCENE_KEY);
  });
});
