import { describe, expect, it, vi } from "vitest";
import { formatDefenseHudText } from "./DefenseHudController";
import { checkDefenseRunEnd } from "./DefenseNightEnd";
import { endlessHudHeader } from "./DefenseEndlessSpawn";
import type { DataStore } from "../../core/DataStore";

const baseHud = {
  header: "Night 3",
  wallHp: 41.7,
  playerHp: 12.9,
  playerHpMax: 20,
  infiniteHp: false,
  invulnerable: false,
  livingEnemies: 2,
  hasFocus: false,
  mode: "melee" as const,
  autoAttackEnabled: false,
  castPhase: null,
  castPct: 0,
  attackPhase: "idle",
};

describe("formatDefenseHudText", () => {
  it("formats the idle four-line HUD", () => {
    expect(formatDefenseHudText(baseHud)).toBe(
      [
        "Night 3 · Wall 41",
        "HP 12/20",
        "Enemies 2 · Melee · Auto OFF",
        "Spells · tap enemy to focus · drag to move",
      ].join("\n"),
    );
  });

  it("shows focus, infinite HP, i-frames, auto mode and cast progress", () => {
    const text = formatDefenseHudText({
      ...baseHud,
      wallHp: -5,
      infiniteHp: true,
      invulnerable: true,
      hasFocus: true,
      mode: "auto",
      autoAttackEnabled: true,
      castPhase: "channeling",
      castPct: 42,
    });
    expect(text.split("\n")).toEqual([
      "Night 3 · Wall 0",
      "HP 12/20 · ∞ (i-frames)",
      "Enemies 2 (focus) · Auto combat · Auto ON",
      "Channeling… 42%",
    ]);
  });

  it("shows the attack phase when not casting", () => {
    const text = formatDefenseHudText({
      ...baseHud,
      attackPhase: "windup",
      mode: "ranged",
    });
    expect(text.split("\n")[2]).toBe("Enemies 2 · Ranged · Auto OFF");
    expect(text.split("\n")[3]).toBe("ATK: windup");
  });
});

describe("checkDefenseRunEnd", () => {
  const base = {
    endless: false,
    nightEnded: false,
    wallHp: 10,
    playerHp: 10,
    infiniteHp: false,
    spawnPlanComplete: false,
    livingEnemies: 1,
  };

  it("ends a campaign night as won when the plan is done and no enemies live", () => {
    const onNightEnd = vi.fn();
    const onEndlessEnd = vi.fn();
    checkDefenseRunEnd({
      ...base,
      spawnPlanComplete: true,
      livingEnemies: 0,
      onNightEnd,
      onEndlessEnd,
    });
    expect(onNightEnd).toHaveBeenCalledWith(true);
    expect(onEndlessEnd).not.toHaveBeenCalled();
  });

  it("does not use wall HP for endless runs", () => {
    const onNightEnd = vi.fn();
    const onEndlessEnd = vi.fn();
    checkDefenseRunEnd({
      ...base,
      endless: true,
      wallHp: 0,
      onNightEnd,
      onEndlessEnd,
    });
    expect(onNightEnd).not.toHaveBeenCalled();
    expect(onEndlessEnd).not.toHaveBeenCalled();
    checkDefenseRunEnd({
      ...base,
      endless: true,
      playerHp: 0,
      onNightEnd,
      onEndlessEnd,
    });
    expect(onEndlessEnd).toHaveBeenCalledWith("player");
  });
});

describe("endlessHudHeader", () => {
  const store = {
    enemies: { goblin: { displayName: "Goblin" } },
  } as unknown as DataStore;

  it("names the first enemy type and counts the rest", () => {
    expect(endlessHudHeader(store, null)).toBe("Endless");
    expect(
      endlessHudHeader(store, [{ enemyId: "goblin", concurrentCap: 1 }]),
    ).toBe("Endless · Goblin");
    expect(
      endlessHudHeader(store, [
        { enemyId: "goblin", concurrentCap: 1 },
        { enemyId: "bat", concurrentCap: 2 },
      ]),
    ).toBe("Endless · Goblin +1");
  });
});
