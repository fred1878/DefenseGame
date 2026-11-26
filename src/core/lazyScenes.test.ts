import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureDebugMenuScene, resetLazyScenesForTests } from "./lazyScenes";

vi.mock("../scenes/DebugMenuScene", () => ({
  DebugMenuScene: class DebugMenuScene {},
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

describe("ensureDefenseScene leftover branches", () => {
  it("registers Defense once and no-ops when it is already present", async () => {
    vi.resetModules();
    vi.doMock("../scenes/DefenseScene", () => ({
      DefenseScene: class DefenseScene {},
    }));
    const { ensureDefenseScene, resetLazyScenesForTests } = await import(
      "./lazyScenes"
    );
    resetLazyScenesForTests();
    const add = vi.fn();
    const game = {
      scene: { getScene: vi.fn(() => null), add },
    } as unknown as Phaser.Game;
    const first = ensureDefenseScene(game);
    const second = ensureDefenseScene(game);
    await Promise.all([first, second]);
    expect(add).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledWith("Defense", expect.any(Function), false);

    resetLazyScenesForTests();
    const already = {
      scene: { getScene: vi.fn(() => ({})), add: vi.fn() },
    } as unknown as Phaser.Game;
    await ensureDefenseScene(already);
    expect(already.scene.add).not.toHaveBeenCalled();
  });
});
