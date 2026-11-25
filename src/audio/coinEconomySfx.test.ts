import { describe, expect, it, vi } from "vitest";
import {
  COIN_GAIN_SFX_KEY,
  COIN_SPEND_SFX_KEY,
  playCoinDeltaSfx,
} from "./coinEconomySfx";

function mockScene(play = vi.fn(), exists = true) {
  return {
    cache: { audio: { exists: vi.fn(() => exists) } },
    sound: { play },
  } as unknown as Phaser.Scene;
}

describe("playCoinDeltaSfx", () => {
  it("plays spend when gold decreases", () => {
    const play = vi.fn();
    const scene = mockScene(play);
    playCoinDeltaSfx(scene, 100, 50);
    expect(play).toHaveBeenCalledWith(
      COIN_SPEND_SFX_KEY,
      expect.objectContaining({ volume: expect.any(Number) }),
    );
  });

  it("plays gain when gold increases", () => {
    const play = vi.fn();
    const scene = mockScene(play);
    playCoinDeltaSfx(scene, 0, 40);
    expect(play).toHaveBeenCalledWith(
      COIN_GAIN_SFX_KEY,
      expect.objectContaining({ volume: expect.any(Number) }),
    );
  });

  it("is silent when gold is unchanged", () => {
    const play = vi.fn();
    const scene = mockScene(play);
    playCoinDeltaSfx(scene, 12, 12);
    expect(play).not.toHaveBeenCalled();
  });
});
