import { describe, expect, it } from "vitest";
import { findEnemyNearWorldPointPure } from "./DefenseTargeting";

describe("findEnemyNearWorldPointPure", () => {
  it("picks closest alive enemy within radius", () => {
    const id = findEnemyNearWorldPointPure(
      [
        { id: "a", x: 100, y: 100, alive: true },
        { id: "b", x: 105, y: 100, alive: true },
        { id: "c", x: 200, y: 200, alive: false },
      ],
      102,
      100,
      10,
    );
    expect(id).toBe("a");
  });

  it("returns null when nothing in range", () => {
    const id = findEnemyNearWorldPointPure(
      [{ id: "a", x: 0, y: 0, alive: true }],
      50,
      50,
      5,
    );
    expect(id).toBeNull();
  });
});
