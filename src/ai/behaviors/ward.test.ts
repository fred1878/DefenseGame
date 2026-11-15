import { describe, expect, it } from "vitest";
import {
  pickWardProtectee,
  wardScreenPoint,
} from "./ward";

describe("ward behavior helpers", () => {
  it("picks the nearest ranged ally within protect radius", () => {
    const allies = [
      { id: "a", behavior: "meleeChaser", x: 50, y: 0 },
      { id: "b", behavior: "javelineer", x: 80, y: 0 },
      { id: "c", behavior: "arrowRainArcher", x: 120, y: 0 },
    ];
    const pick = pickWardProtectee(allies, 0, 0, 200);
    expect(pick?.id).toBe("b");
  });

  it("places screen point between ally and player", () => {
    const p = wardScreenPoint(100, 0, 0, 0, 0.5);
    expect(p.x).toBe(50);
    expect(p.y).toBe(0);
  });
});