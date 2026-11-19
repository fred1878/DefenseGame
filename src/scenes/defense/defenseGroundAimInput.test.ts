import { describe, expect, it } from "vitest";
import {
  groundAimFromWorldPoint,
  pointerInDefensePlayArea,
} from "./defenseGroundAimInput";

const playArea = {
  x: 0,
  y: 100,
  width: 540,
  height: 800,
  topBandBottom: 100,
  bottomBandTop: 900,
};

describe("pointerInDefensePlayArea", () => {
  it("accepts points inside the play band", () => {
    expect(pointerInDefensePlayArea(270, 500, playArea)).toBe(true);
  });

  it("rejects HUD and bottom chrome", () => {
    expect(pointerInDefensePlayArea(270, 50, playArea)).toBe(false);
    expect(pointerInDefensePlayArea(270, 950, playArea)).toBe(false);
  });
});

describe("groundAimFromWorldPoint", () => {
  it("clamps drag aim to max range from player", () => {
    const aim = groundAimFromWorldPoint(10, 20, 500, 20, 100);
    expect(aim.x).toBe(110);
    expect(aim.y).toBe(20);
  });

  it("keeps in-range world points", () => {
    const aim = groundAimFromWorldPoint(0, 0, 30, 40, 100);
    expect(aim).toEqual({ x: 30, y: 40 });
  });
});