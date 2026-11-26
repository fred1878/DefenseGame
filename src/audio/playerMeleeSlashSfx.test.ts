import { describe, expect, it, vi } from "vitest";
import {
  PLAYER_MELEE_SLASH_SFX_KEYS,
  pickPlayerMeleeSlashSfxKey,
  playPlayerMeleeSlashSfx,
} from "./playerMeleeSlashSfx";

describe("pickPlayerMeleeSlashSfxKey", () => {
  it("alternates between the two slash clips", () => {
    expect(pickPlayerMeleeSlashSfxKey(() => 0)).toBe(
      PLAYER_MELEE_SLASH_SFX_KEYS[0],
    );
    expect(pickPlayerMeleeSlashSfxKey(() => 0.49)).toBe(
      PLAYER_MELEE_SLASH_SFX_KEYS[0],
    );
    expect(pickPlayerMeleeSlashSfxKey(() => 0.5)).toBe(
      PLAYER_MELEE_SLASH_SFX_KEYS[1],
    );
    expect(pickPlayerMeleeSlashSfxKey(() => 0.99)).toBe(
      PLAYER_MELEE_SLASH_SFX_KEYS[1],
    );
  });
});

describe("playPlayerMeleeSlashSfx", () => {
  it("skips playback when the clip is not in the audio cache", () => {
    const play = vi.fn();
    playPlayerMeleeSlashSfx({
      cache: { audio: { exists: () => false } },
      sound: { play },
    } as unknown as Phaser.Scene);
    expect(play).not.toHaveBeenCalled();
  });

  it("plays a slash clip when the cache has it", () => {
    const play = vi.fn();
    playPlayerMeleeSlashSfx({
      cache: { audio: { exists: () => true } },
      sound: { play },
    } as unknown as Phaser.Scene);
    expect(play).toHaveBeenCalledTimes(1);
    const key = play.mock.calls[0]?.[0];
    expect(PLAYER_MELEE_SLASH_SFX_KEYS).toContain(key);
  });
});
