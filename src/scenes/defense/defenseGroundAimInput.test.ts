import { describe, expect, it } from "vitest";
import {
  groundAimFromWorldPoint,
  pointerInDefensePlayArea,
  resolveArmedGroundPointerUp,
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

describe("resolveArmedGroundPointerUp", () => {
  const barPress = {
    isAimGesture: true,
    fromUiBand: true,
    dragExceeded: false,
    releaseInPlayArea: false,
  };

  it("ignores a short tap on the spell bar so the bar can auto-cast", () => {
    expect(resolveArmedGroundPointerUp(barPress)).toBe("ignore");
  });

  it("places on drag-release in the play area, including empty ground", () => {
    expect(
      resolveArmedGroundPointerUp({
        ...barPress,
        dragExceeded: true,
        releaseInPlayArea: true,
      }),
    ).toBe("confirm");
  });

  it("cancels when a drag is released back on the bar or HUD", () => {
    expect(
      resolveArmedGroundPointerUp({
        ...barPress,
        dragExceeded: true,
        releaseInPlayArea: false,
      }),
    ).toBe("cancel");
  });

  it("ignores a pointer that is not the armed gesture", () => {
    expect(
      resolveArmedGroundPointerUp({ ...barPress, isAimGesture: false }),
    ).toBe("ignore");
  });

  it("confirms a later pointer that started in the play area", () => {
    expect(
      resolveArmedGroundPointerUp({
        isAimGesture: true,
        fromUiBand: false,
        dragExceeded: false,
        releaseInPlayArea: true,
      }),
    ).toBe("confirm");
  });
});
