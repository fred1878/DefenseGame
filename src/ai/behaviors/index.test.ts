import { describe, expect, it } from "vitest";
import { getEnemyBehavior } from "./index";
import { meleeChaserBehavior } from "./meleeChaser";
import { wardBehavior } from "./ward";

describe("getEnemyBehavior", () => {
  it("returns a named behavior and falls back to melee chaser", () => {
    expect(getEnemyBehavior("ward")).toBe(wardBehavior);
    expect(getEnemyBehavior("not_a_behavior")).toBe(meleeChaserBehavior);
  });
});
