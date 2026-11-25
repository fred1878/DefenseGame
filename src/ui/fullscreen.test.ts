import { describe, expect, it, vi } from "vitest";
import {
  fullscreenAvailable,
  fullscreenButtonLabel,
  toggleFullscreen,
} from "./fullscreen";

function scale(partial: {
  available?: boolean;
  isFullscreen?: boolean;
}): Phaser.Scale.ScaleManager {
  return {
    fullscreen: { available: partial.available ?? true },
    isFullscreen: partial.isFullscreen ?? false,
    startFullscreen: vi.fn(),
    stopFullscreen: vi.fn(),
  } as unknown as Phaser.Scale.ScaleManager;
}

describe("fullscreen helpers", () => {
  it("reports availability from the scale manager", () => {
    expect(fullscreenAvailable(scale({ available: false }))).toBe(false);
    expect(fullscreenAvailable(scale({ available: true }))).toBe(true);
  });

  it("labels the button for unavailable, windowed, and fullscreen states", () => {
    expect(fullscreenButtonLabel(scale({ available: false }))).toBe(
      "Fullscreen: N/A (iOS)",
    );
    expect(fullscreenButtonLabel(scale({ isFullscreen: false }))).toBe(
      "Fullscreen",
    );
    expect(fullscreenButtonLabel(scale({ isFullscreen: true }))).toBe(
      "Exit fullscreen",
    );
  });

  it("toggles fullscreen only when the API is available", () => {
    const unavailable = scale({ available: false });
    toggleFullscreen(unavailable);
    expect(unavailable.startFullscreen).not.toHaveBeenCalled();
    expect(unavailable.stopFullscreen).not.toHaveBeenCalled();

    const windowed = scale({ isFullscreen: false });
    toggleFullscreen(windowed);
    expect(windowed.startFullscreen).toHaveBeenCalledOnce();
    expect(windowed.stopFullscreen).not.toHaveBeenCalled();

    const full = scale({ isFullscreen: true });
    toggleFullscreen(full);
    expect(full.stopFullscreen).toHaveBeenCalledOnce();
    expect(full.startFullscreen).not.toHaveBeenCalled();
  });
});
