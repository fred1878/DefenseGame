import { beforeEach, describe, expect, it, vi } from "vitest";

const nightEnd = vi.hoisted(() => ({
  runDefenseCampaignNightEnd: vi.fn(),
  runDefenseEndlessNightEnd: vi.fn(),
  runDefenseSimulatedNightEnd: vi.fn(),
}));
vi.mock("./DefenseNightEnd", () => nightEnd);

import type { DataStore } from "../../core/DataStore";
import {
  type DefenseRunModeContext,
  defenseRunModeStrategy,
} from "./DefenseRunModes";
import type { DefenseRunState } from "./DefenseRunState";

function ctx(): DefenseRunModeContext {
  const run = {
    save: { night: 4 },
    wallHp: 30,
    wallHpStart: 50,
    rewardGold: 70,
    endlessSelections: [{ enemyId: "grunt" }],
  } as unknown as DefenseRunState;
  const store = {
    enemies: { grunt: { displayName: "Grunt" } },
  } as unknown as DataStore;
  const shared = { tag: "shared" };
  return { run, store, nightEnd: () => shared as never };
}

describe("defenseRunModeStrategy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("formats a HUD header per mode", () => {
    const c = ctx();
    expect(defenseRunModeStrategy("campaign").hudHeader(c)).toBe("Night 4");
    expect(defenseRunModeStrategy("endless").hudHeader(c)).toBe(
      "Endless · Grunt",
    );
    expect(defenseRunModeStrategy("wavePlanner").hudHeader(c)).toBe(
      "Wave planner",
    );
  });

  it("campaign night end passes run totals and loss reason only on a loss", () => {
    const c = ctx();
    defenseRunModeStrategy("campaign").endNight(c, false, "wall");
    expect(nightEnd.runDefenseCampaignNightEnd).toHaveBeenCalledWith(
      { tag: "shared" },
      {
        won: false,
        lossReason: "wall",
        wallHp: 30,
        wallHpStart: 50,
        rewardGold: 70,
        save: c.run.save,
      },
    );
    defenseRunModeStrategy("endless").endNight(c, true, "wall");
    expect(nightEnd.runDefenseCampaignNightEnd).toHaveBeenLastCalledWith(
      { tag: "shared" },
      expect.not.objectContaining({ lossReason: "wall" }),
    );
  });

  it("wave planner ends and quits as a simulated night", () => {
    const c = ctx();
    const wp = defenseRunModeStrategy("wavePlanner");
    wp.endNight(c, true);
    wp.leave(c);
    expect(nightEnd.runDefenseSimulatedNightEnd).toHaveBeenNthCalledWith(
      1,
      { tag: "shared" },
      { won: true },
    );
    expect(nightEnd.runDefenseSimulatedNightEnd).toHaveBeenNthCalledWith(
      2,
      { tag: "shared" },
      { won: false, quit: true },
    );
  });

  it("campaign and endless leave as an endless quit", () => {
    const c = ctx();
    defenseRunModeStrategy("campaign").leave(c);
    defenseRunModeStrategy("endless").leave(c);
    expect(nightEnd.runDefenseEndlessNightEnd).toHaveBeenCalledTimes(2);
    expect(nightEnd.runDefenseEndlessNightEnd).toHaveBeenCalledWith(
      { tag: "shared" },
      "quit",
    );
  });
});
