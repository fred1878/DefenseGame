import { describe, expect, it } from "vitest";
import { SPELL_BAR } from "../config";
import {
  applyEndlessRunExit,
  applyNightResult,
  createNewSave,
  playerDamageMult,
  prepareDefenseNight,
  wallHpBonusFromBuildings,
} from "./GameState";

describe("GameState", () => {
  it("creates a valid starting save", () => {
    const save = createNewSave();
    expect(save.night).toBe(1);
    expect(save.townWallHp).toBe(save.townWallHpMax);
    expect(save.player.hp).toBe(save.player.hpMax);
    expect(save.spellBar.slots).toHaveLength(SPELL_BAR.slotCount);
  });

  it("applies a won night", () => {
    const save = createNewSave();
    const result = {
      won: true,
      goldEarned: 40,
      wallDamage: 5,
      night: 1,
    };
    const next = applyNightResult(save, result);
    expect(next.gold).toBe(40);
    expect(next.night).toBe(2);
    expect(next.townWallHp).toBe(save.townWallHp - 5);
  });

  it("scales building modifiers", () => {
    expect(wallHpBonusFromBuildings({ wall: 2 })).toBe(100);
    expect(playerDamageMult({ blacksmith: 1 })).toBeCloseTo(1.1);
  });

  it("prepares defense after a lost night at 0 wall or player hp", () => {
    const save = createNewSave();
    save.townWallHp = 0;
    save.player.hp = 0;
    const ready = prepareDefenseNight(save);
    expect(ready.townWallHp).toBe(save.townWallHpMax);
    expect(ready.player.hp).toBe(save.player.hpMax);
    expect(ready.night).toBe(1);
  });

  it("applyEndlessRunExit updates hp without gold or night", () => {
    const save = createNewSave();
    save.gold = 12;
    save.night = 3;
    const next = applyEndlessRunExit(save, 88, 45);
    expect(next.gold).toBe(12);
    expect(next.night).toBe(3);
    expect(next.townWallHp).toBe(88);
    expect(next.player.hp).toBe(45);
  });

  it("keeps partial wall hp when retrying after player death", () => {
    const save = createNewSave();
    save.townWallHp = 72;
    save.player.hp = 1;
    const ready = prepareDefenseNight(save);
    expect(ready.townWallHp).toBe(72);
    expect(ready.player.hp).toBe(1);
  });
});