import { describe, expect, it, vi } from "vitest";
import {
  ARROW_RAIN_TELEGRAPH_PALETTE,
  LOBBER_TELEGRAPH_PALETTE,
  spawnArrowRainTelegraph,
  updateArrowRainTelegraph,
} from "./ArrowRainTelegraph";

describe("ArrowRainTelegraph palettes", () => {
  it("uses orange/gold default and distinct purple for lobber", () => {
    expect(ARROW_RAIN_TELEGRAPH_PALETTE.stroke).toBe(0xffcc66);
    expect(ARROW_RAIN_TELEGRAPH_PALETTE.fill).toBe(0xff5533);
    expect(LOBBER_TELEGRAPH_PALETTE.fill).not.toBe(ARROW_RAIN_TELEGRAPH_PALETTE.fill);
    expect(LOBBER_TELEGRAPH_PALETTE.stroke).not.toBe(ARROW_RAIN_TELEGRAPH_PALETTE.stroke);
  });

  it("draws windup strokes using the telegraph palette", () => {
    const gfx = {
      setDepth: vi.fn(),
      clear: vi.fn(),
      lineStyle: vi.fn(),
      fillStyle: vi.fn(),
      strokeCircle: vi.fn(),
      fillCircle: vi.fn(),
      destroy: vi.fn(),
    };
    const scene = {
      add: { graphics: () => gfx },
    } as unknown as import("phaser").Scene;

    const telegraph = spawnArrowRainTelegraph(
      scene,
      0,
      0,
      400,
      50,
      LOBBER_TELEGRAPH_PALETTE,
    );
    updateArrowRainTelegraph(telegraph, 200, false);

    const strokeCalls = gfx.lineStyle.mock.calls.map((c) => c[1]);
    expect(strokeCalls).toContain(LOBBER_TELEGRAPH_PALETTE.stroke);
    expect(strokeCalls).toContain(LOBBER_TELEGRAPH_PALETTE.inner);
    expect(strokeCalls).not.toContain(ARROW_RAIN_TELEGRAPH_PALETTE.stroke);
    expect(gfx.fillStyle).toHaveBeenCalledWith(
      LOBBER_TELEGRAPH_PALETTE.fill,
      expect.any(Number),
    );
  });
});