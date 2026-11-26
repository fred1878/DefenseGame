import { describe, expect, it, vi } from "vitest";
import { FpsDebugOverlay } from "./FpsDebugOverlay";
import { setShowFpsCounter } from "./DebugState";

function fakeRegistry(
  store: Record<string, unknown> = {},
): Phaser.Data.DataManager {
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as Phaser.Data.DataManager;
}

describe("FpsDebugOverlay", () => {
  it("stays hidden when the debug flag is off", () => {
    const reg = fakeRegistry();
    const setVisible = vi.fn();
    const destroy = vi.fn();
    const scene = {
      scale: { width: 540 },
      scene: { key: "Town" },
      registry: { get: () => undefined },
      add: {
        text: () => ({
          setOrigin: () => ({
            setScrollFactor: () => ({
              setDepth: () => ({
                setVisible,
                setText: vi.fn(),
                destroy,
              }),
            }),
          }),
        }),
      },
    } as unknown as Phaser.Scene;
    const overlay = new FpsDebugOverlay(scene);
    overlay.tick(reg, 16.67, { loop: { actualFps: 60 } } as Phaser.Game);
    expect(setVisible).toHaveBeenCalledWith(false);
    overlay.destroy();
    expect(destroy).toHaveBeenCalled();
  });

  it("shows smoothed fps and frame time when enabled", () => {
    const reg = fakeRegistry();
    setShowFpsCounter(reg, true);
    const setText = vi.fn();
    const setVisible = vi.fn();
    const scene = {
      scale: { width: 540 },
      scene: { key: "Town" },
      registry: { get: () => undefined },
      add: {
        text: () => ({
          setOrigin: () => ({
            setScrollFactor: () => ({
              setDepth: () => ({
                setVisible,
                setText,
                destroy: vi.fn(),
              }),
            }),
          }),
        }),
      },
    } as unknown as Phaser.Scene;
    const overlay = new FpsDebugOverlay(scene);
    overlay.tick(reg, 20, { loop: { actualFps: 55 } } as Phaser.Game);
    overlay.tick(reg, 20, { loop: { actualFps: 55 } } as Phaser.Game);
    expect(setVisible).toHaveBeenCalledWith(true);
    expect(setText).toHaveBeenCalled();
    const last = setText.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/FPS/);
    expect(last).toMatch(/ms/);
  });

  it("falls back to the loop fps when the frame delta is zero", () => {
    const reg = fakeRegistry();
    setShowFpsCounter(reg, true);
    const setText = vi.fn();
    const setVisible = vi.fn();
    const scene = {
      scale: { width: 540 },
      scene: { key: "Town" },
      registry: { get: () => undefined },
      add: {
        text: () => ({
          setOrigin: () => ({
            setScrollFactor: () => ({
              setDepth: () => ({
                setVisible,
                setText,
                destroy: vi.fn(),
              }),
            }),
          }),
        }),
      },
    } as unknown as Phaser.Scene;
    const overlay = new FpsDebugOverlay(scene);
    overlay.tick(reg, 0, { loop: { actualFps: 48 } } as Phaser.Game);
    expect(setVisible).toHaveBeenCalledWith(true);
    expect(String(setText.mock.calls.at(-1)?.[0])).toContain("48.0 FPS");
  });
});
