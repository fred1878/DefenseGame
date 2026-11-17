import { describe, expect, it } from "vitest";
import {
  PLAYER_MELEE_SLASH_SFX_KEYS,
  pickPlayerMeleeSlashSfxKey,
} from "./playerMeleeSlashSfx";

describe("pickPlayerMeleeSlashSfxKey", () => {
  it("alternates between the two slash clips", () => {
    expect(pickPlayerMeleeSlashSfxKey(() => 0)).toBe(PLAYER_MELEE_SLASH_SFX_KEYS[0]);
    expect(pickPlayerMeleeSlashSfxKey(() => 0.49)).toBe(PLAYER_MELEE_SLASH_SFX_KEYS[0]);
    expect(pickPlayerMeleeSlashSfxKey(() => 0.5)).toBe(PLAYER_MELEE_SLASH_SFX_KEYS[1]);
    expect(pickPlayerMeleeSlashSfxKey(() => 0.99)).toBe(PLAYER_MELEE_SLASH_SFX_KEYS[1]);
  });
});