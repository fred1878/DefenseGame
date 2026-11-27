import { describe, expect, it } from "vitest";
import {
  campaignNightEndFlavor,
  campaignNightEndHeadline,
  campaignNightProgressNote,
  simulatedNightEndHeadline,
  simulatedNightEndHudLines,
  trainingEndHeadline,
  trainingEndHudLines,
} from "./nightEndMessaging";

describe("campaignNightEndHeadline", () => {
  it("distinguishes win, wall loss, player loss, and generic loss", () => {
    expect(campaignNightEndHeadline(true, 4)).toBe("Night 4 defended!");
    expect(campaignNightEndHeadline(false, 4, "wall")).toBe(
      "Night 4 — wall breached",
    );
    expect(campaignNightEndHeadline(false, 4, "player")).toBe(
      "Night 4 — you fell",
    );
    expect(campaignNightEndHeadline(false, 4)).toBe("Night 4 lost");
  });
});

describe("campaignNightProgressNote", () => {
  it("explains campaign vs training outcomes", () => {
    expect(campaignNightProgressNote(true, 3)).toContain("night 4");
    expect(campaignNightProgressNote(true, 3)).toContain("Gallows");
    expect(campaignNightProgressNote(false, 3)).toContain("stays on night 3");
    expect(campaignNightProgressNote(false, 3)).toContain("no night advance");
  });
});

describe("trainingEndHudLines", () => {
  it("states that endless runs skip campaign progress", () => {
    const [scope, economy] = trainingEndHudLines("player");
    expect(scope).toContain("Endless");
    expect(economy).toContain("No gold");
    expect(trainingEndHeadline("wall")).toContain("Wall breached");
    const quit = trainingEndHudLines("quit");
    expect(quit[0]).toContain("Custom run");
  });
});

describe("simulatedNightEnd", () => {
  it("labels planner exits", () => {
    expect(simulatedNightEndHeadline(true, false)).toContain("complete");
    expect(simulatedNightEndHudLines()[0]).toContain("planner");
  });
});

describe("campaignNightEndFlavor", () => {
  it("matches wall and player failure", () => {
    expect(campaignNightEndFlavor(false, "wall")).toContain("north wall");
    expect(campaignNightEndFlavor(false, "player")).toContain("collapse");
  });
});
