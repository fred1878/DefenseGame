import { describe, expect, it, vi } from "vitest";
import {
  ENEMY_MELEE_SLASH_SFX_KEYS,
  pickEnemyMeleeSlashSfxKey,
  playEnemyMeleeSlashSfx,
} from "./enemyMeleeSlashSfx";

describe("pickEnemyMeleeSlashSfxKey", () => {
  it("alternates between the two slash clips", () => {
    expect(pickEnemyMeleeSlashSfxKey(() => 0)).toBe(
      ENEMY_MELEE_SLASH_SFX_KEYS[0],
    );
    expect(pickEnemyMeleeSlashSfxKey(() => 0.49)).toBe(
      ENEMY_MELEE_SLASH_SFX_KEYS[0],
    );
    expect(pickEnemyMeleeSlashSfxKey(() => 0.5)).toBe(
      ENEMY_MELEE_SLASH_SFX_KEYS[1],
    );
    expect(pickEnemyMeleeSlashSfxKey(() => 0.99)).toBe(
      ENEMY_MELEE_SLASH_SFX_KEYS[1],
    );
  });
});

describe("playEnemyMeleeSlashSfx", () => {
  it("skips playback when the clip is not in the audio cache", () => {
    const play = vi.fn();
    playEnemyMeleeSlashSfx({
      cache: { audio: { exists: () => false } },
      sound: { play },
    } as unknown as Phaser.Scene);
    expect(play).not.toHaveBeenCalled();
  });

  it("plays a slash clip when the cache has it", () => {
    const play = vi.fn();
    playEnemyMeleeSlashSfx({
      cache: { audio: { exists: () => true } },
      sound: { play },
    } as unknown as Phaser.Scene);
    expect(play).toHaveBeenCalledTimes(1);
    const key = play.mock.calls[0]?.[0];
    expect(ENEMY_MELEE_SLASH_SFX_KEYS).toContain(key);
  });
});
