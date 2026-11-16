import { describe, expect, it } from "vitest";
import {
  blinkDestination,
  clampGroundTarget,
  enemiesInCone,
  enemiesInDisk,
  pickChainLightningTargets,
} from "./spellMechanics";

const enemies = [
  { id: "a", x: 40, y: 0, radius: 10 },
  { id: "b", x: 0, y: 50, radius: 10 },
  { id: "c", x: 100, y: 0, radius: 10 },
];

describe("spellMechanics", () => {
  it("enemiesInDisk includes overlapping radii", () => {
    const hit = enemiesInDisk(0, 0, 45, enemies);
    expect(hit.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("enemiesInCone filters by facing", () => {
    const hit = enemiesInCone(0, 0, 0, 120, Math.PI / 4, enemies);
    expect(hit.map((e) => e.id)).toContain("a");
    expect(hit.map((e) => e.id)).not.toContain("b");
  });

  it("chain lightning picks ordered hops", () => {
    const chain = pickChainLightningTargets(0, 0, enemies, 3, 120);
    expect(chain[0]?.id).toBe("a");
    expect(chain.length).toBeGreaterThanOrEqual(1);
  });

  it("clampGroundTarget clamps to max range", () => {
    const p = clampGroundTarget(0, 0, 300, 0, 100);
    expect(p.x).toBe(100);
    expect(p.y).toBe(0);
  });

  it("blink clamps to bounds", () => {
    const dst = blinkDestination(
      0,
      0,
      0,
      500,
      { minX: -50, maxX: 50, minY: -50, maxY: 50 },
    );
    expect(dst.x).toBe(50);
    expect(dst.y).toBe(0);
  });
});