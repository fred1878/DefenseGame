import { describe, expect, it } from "vitest";
import {
  ENEMY_MELEE_SLASH_SFX_KEYS,
  pickEnemyMeleeSlashSfxKey,
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
