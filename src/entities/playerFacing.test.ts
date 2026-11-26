import { describe, expect, it } from "vitest";
import { cardinalFromAngle, cardinalFromDelta } from "./playerFacing";

describe("playerFacing", () => {
  it("maps deltas to cardinals", () => {
    expect(cardinalFromDelta(0, 0)).toBeNull();
    expect(cardinalFromDelta(2, 1)).toBe("e");
    expect(cardinalFromDelta(-2, 1)).toBe("w");
    expect(cardinalFromDelta(1, 2)).toBe("s");
    expect(cardinalFromDelta(1, -2)).toBe("n");
  });

  it("maps angles to cardinals including north and west", () => {
    expect(cardinalFromAngle(0)).toBe("e");
    expect(cardinalFromAngle(Math.PI / 2)).toBe("s");
    expect(cardinalFromAngle(-Math.PI / 2)).toBe("n");
    expect(cardinalFromAngle(Math.PI)).toBe("w");
    expect(cardinalFromAngle(-Math.PI)).toBe("w");
  });
});
