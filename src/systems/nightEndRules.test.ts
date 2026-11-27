import { describe, expect, it } from "vitest";
import { createNewSave } from "../core/save/GameState";
import type { LootConfig } from "../gear/loot";
import { gearFixture } from "../test/gearFixture";
import {
  evaluateEndlessEnd,
  evaluateNightEnd,
  resolveCampaignNightEndSave,
  resolveRunExitSave,
  survivedPlayerHp,
} from "./nightEndRules";

describe("evaluateNightEnd", () => {
  const base = {
    nightEnded: false,
    wallHp: 100,
    playerHp: 50,
    spawnPlanComplete: true,
    livingEnemies: 2,
  };

  it("ignores updates after night already ended", () => {
    expect(evaluateNightEnd({ ...base, nightEnded: true })).toBe(false);
  });

  it("loss when wall reaches zero", () => {
    expect(evaluateNightEnd({ ...base, wallHp: 0 })).toEqual({
      won: false,
      lossReason: "wall",
    });
  });

  it("loss when player hp reaches zero", () => {
    expect(evaluateNightEnd({ ...base, playerHp: 0 })).toEqual({
      won: false,
      lossReason: "player",
    });
  });

  it("win when spawn plan done and no living enemies", () => {
    expect(evaluateNightEnd({ ...base, livingEnemies: 0 })).toEqual({
      won: true,
    });
  });

  it("no end while enemies remain", () => {
    expect(evaluateNightEnd(base)).toBe(false);
  });

  it("no win before spawn plan completes", () => {
    expect(
      evaluateNightEnd({ ...base, spawnPlanComplete: false, livingEnemies: 0 }),
    ).toBe(false);
  });
});

describe("evaluateEndlessEnd", () => {
  const base = { nightEnded: false, playerHp: 40 };

  it("does not end when spawns are clear", () => {
    expect(evaluateEndlessEnd(base)).toBe(false);
  });

  it("ends on player death", () => {
    expect(evaluateEndlessEnd({ ...base, playerHp: 0 })).toEqual({
      reason: "player",
    });
  });

  it("does not end on player death when infinite HP is enabled", () => {
    expect(evaluateEndlessEnd({ ...base, playerHp: 0, infiniteHp: true })).toBe(
      false,
    );
  });
});

describe("night-end save rules", () => {
  const loot: LootConfig = {
    inventoryCapacity: 8,
    sellBackPct: 50,
    lostNightGoldPct: 25,
    tables: {},
  };

  it("survivedPlayerHp floors and clamps at zero", () => {
    expect(survivedPlayerHp(12.9)).toBe(12);
    expect(survivedPlayerHp(-3)).toBe(0);
  });

  it("resolveRunExitSave carries wall and HP without advancing the night", () => {
    const save = createNewSave();
    save.night = 5;
    save.gold = 7;
    const next = resolveRunExitSave(save, -4, 20.7);
    expect(next.night).toBe(5);
    expect(next.gold).toBe(7);
    expect(next.townWallHp).toBe(0);
    expect(next.player.hp).toBe(20);
    expect(next).not.toBe(save);
  });

  it("resolveCampaignNightEndSave keeps at least 1 HP and caps at max", () => {
    const save = createNewSave();
    const base = {
      wallHp: 50,
      wallHpStart: 60,
      rewardGold: 10,
      save,
      drops: [],
      catalog: gearFixture(),
      loot,
    };
    const lost = resolveCampaignNightEndSave({
      ...base,
      won: false,
      lossReason: "player",
      playerHp: 0,
    });
    expect(lost.save.player.hp).toBe(1);
    const won = resolveCampaignNightEndSave({
      ...base,
      won: true,
      playerHp: 10_000,
    });
    expect(won.save.player.hp).toBe(won.save.player.hpMax);
    expect(won.result.goldEarned).toBe(10);
  });
});
