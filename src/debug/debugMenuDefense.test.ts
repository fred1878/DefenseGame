import { describe, expect, it, vi } from "vitest";
import { isDefenseDebugHost } from "./debugMenuLifecycle";

describe("isDefenseDebugHost", () => {
  it("is true only when Defense is paused under the overlay", () => {
    const defense = {
      scene: {
        isPaused: vi.fn((key: string) => key === "Defense"),
      },
    };
    const scene = {
      scene: {
        get: vi.fn((key: string) => (key === "Defense" ? defense : null)),
      },
    } as unknown as Phaser.Scene;
    expect(isDefenseDebugHost(scene)).toBe(true);
    defense.scene.isPaused.mockReturnValue(false);
    expect(isDefenseDebugHost(scene)).toBe(false);
  });
});