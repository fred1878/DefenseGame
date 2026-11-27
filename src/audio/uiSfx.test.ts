import { describe, expect, it, vi } from "vitest";
import { playUiSfx, type UiSfx } from "./uiSfx";

function mockScene(play = vi.fn(), exists = true) {
  return {
    cache: { audio: { exists: vi.fn(() => exists) } },
    sound: { play },
  } as unknown as Phaser.Scene;
}

const IDS: UiSfx[] = [
  "panelOpen",
  "panelClose",
  "click",
  "tab",
  "sell",
  "equip",
  "upgrade",
  "error",
];

describe("playUiSfx", () => {
  it("plays every menu sound at its configured volume", () => {
    for (const id of IDS) {
      const play = vi.fn();
      playUiSfx(mockScene(play), id);
      expect(play).toHaveBeenCalledWith(
        expect.stringMatching(/^sfx_ui_/),
        expect.objectContaining({ volume: expect.any(Number) }),
      );
    }
  });

  it("is silent when the clip is not loaded", () => {
    const play = vi.fn();
    playUiSfx(mockScene(play, false), "sell");
    expect(play).not.toHaveBeenCalled();
  });
});
