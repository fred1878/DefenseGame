import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureDebugMenuScene,
  ensureEndlessModeSetupScene,
  ensureWavePlannerSetupScene,
  resetLazyScenesForTests,
} from "./lazyScenes";

vi.mock("../scenes/DebugMenuScene", () => ({
  DebugMenuScene: class DebugMenuScene {},
}));

vi.mock("../scenes/EndlessModeSetupScene", () => ({
  EndlessModeSetupScene: class EndlessModeSetupScene {},
}));

vi.mock("../scenes/WavePlannerSetupScene", () => ({
  WavePlannerSetupScene: class WavePlannerSetupScene {},
}));

describe("ensureDebugMenuScene", () => {
  beforeEach(() => {
    resetLazyScenesForTests();
  });

  it("registers DebugMenu when not yet on the game", async () => {
    const add = vi.fn();
    const game = {
      scene: {
        getScene: vi.fn(() => null),
        add,
      },
    } as unknown as Phaser.Game;

    await ensureDebugMenuScene(game);

    expect(game.scene.getScene).toHaveBeenCalledWith("DebugMenu");
    expect(add).toHaveBeenCalledWith("DebugMenu", expect.any(Function), false);
  });

  it("is a no-op when DebugMenu is already registered", async () => {
    const add = vi.fn();
    const game = {
      scene: {
        getScene: vi.fn(() => ({})),
        add,
      },
    } as unknown as Phaser.Game;

    await ensureDebugMenuScene(game);

    expect(add).not.toHaveBeenCalled();
  });

  // Regression: Defense debug must call ensureDebugMenuScene before launch (see TownScene).
  // PR #277 removed DebugMenu from the initial scene list; launching without ensure crashes.
});

describe("ensureEndlessModeSetupScene", () => {
  beforeEach(() => {
    resetLazyScenesForTests();
  });

  it("registers TownEndlessSetup when not yet on the game", async () => {
    const add = vi.fn();
    const game = {
      scene: {
        getScene: vi.fn(() => null),
        add,
      },
    } as unknown as Phaser.Game;

    await ensureEndlessModeSetupScene(game);

    expect(game.scene.getScene).toHaveBeenCalledWith("TownEndlessSetup");
    expect(add).toHaveBeenCalledWith(
      "TownEndlessSetup",
      expect.any(Function),
      false,
    );
  });
});

describe("ensureWavePlannerSetupScene", () => {
  beforeEach(() => {
    resetLazyScenesForTests();
  });

  it("registers TownWavePlannerSetup when not yet on the game", async () => {
    const add = vi.fn();
    const game = {
      scene: {
        getScene: vi.fn(() => null),
        add,
      },
    } as unknown as Phaser.Game;

    await ensureWavePlannerSetupScene(game);

    expect(game.scene.getScene).toHaveBeenCalledWith("TownWavePlannerSetup");
    expect(add).toHaveBeenCalledWith(
      "TownWavePlannerSetup",
      expect.any(Function),
      false,
    );
  });
});
