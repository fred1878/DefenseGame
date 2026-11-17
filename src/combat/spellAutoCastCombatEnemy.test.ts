import { describe, expect, it } from "vitest";
import { pickAutoCastCombatEnemy } from "./spellAutoCastCombatEnemy";

const enemies = [
  { id: "near", x: 80, y: 0, radius: 10, alive: true },
  { id: "far", x: 400, y: 0, radius: 10, alive: true },
  { id: "side", x: 0, y: 60, radius: 10, alive: true },
];

describe("pickAutoCastCombatEnemy", () => {
  it("returns focused enemy in strike range", () => {
    const pick = pickAutoCastCombatEnemy(
      0,
      0,
      "side",
      enemies,
      "ranged",
      50,
      120,
      240,
    );
    expect(pick?.id).toBe("side");
    expect(pick?.x).toBe(0);
    expect(pick?.y).toBe(60);
  });

  it("uses nearest in strike range when no focus", () => {
    const pick = pickAutoCastCombatEnemy(
      0,
      0,
      null,
      enemies,
      "ranged",
      50,
      120,
      240,
    );
    expect(pick?.id).toBe("side");
  });

  it("ignores focus outside strike range and picks nearest in range", () => {
    const pick = pickAutoCastCombatEnemy(
      0,
      0,
      "far",
      enemies,
      "ranged",
      50,
      120,
      240,
    );
    expect(pick?.id).toBe("side");
  });

  it("falls back to nearest within search range when outside strike range", () => {
    const pick = pickAutoCastCombatEnemy(
      0,
      0,
      null,
      [{ id: "far", x: 200, y: 0, radius: 10, alive: true }],
      "ranged",
      50,
      80,
      240,
    );
    expect(pick?.id).toBe("far");
    expect(pick?.x).toBe(200);
  });

  it("returns null when no enemy is in search range", () => {
    const pick = pickAutoCastCombatEnemy(
      0,
      0,
      null,
      [{ id: "far", x: 500, y: 0, radius: 10, alive: true }],
      "ranged",
      50,
      80,
      100,
    );
    expect(pick).toBeNull();
  });
});