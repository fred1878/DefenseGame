import { describe, expect, it } from "vitest";
import {
  blinkDestination,
  clampGroundTarget,
  enemiesInCone,
  enemiesInDisk,
  isBlinkLandingBlocked,
  pickChainLightningTargets,
  resolveBlinkLanding,
} from "./spellMechanics";

const blinkResolve = {
  binarySearchIterations: 24,
  partialMoveEpsilonPx: 0.5,
};

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

  it("resolveBlinkLanding slides back from a blocked obstacle", () => {
    const bounds = { minX: -200, maxX: 200, minY: -200, maxY: 200 };
    const obstacle = { left: 70, top: -20, right: 110, bottom: 20 };
    const landing = resolveBlinkLanding(
      0,
      0,
      0,
      120,
      bounds,
      16,
      [obstacle],
      [],
      blinkResolve,
    );
    expect(landing.moved).toBe(true);
    expect(landing.x).toBeLessThan(70 - 16);
    expect(isBlinkLandingBlocked(landing.x, landing.y, 16, [obstacle], [])).toBe(
      false,
    );
  });

  it("resolveBlinkLanding slides back from an enemy at the endpoint", () => {
    const bounds = { minX: -200, maxX: 200, minY: -200, maxY: 200 };
    const enemies = [{ id: "e", x: 100, y: 0, radius: 18 }];
    const landing = resolveBlinkLanding(
      0,
      0,
      0,
      120,
      bounds,
      16,
      [],
      enemies,
      blinkResolve,
    );
    expect(landing.moved).toBe(true);
    const gap =
      Math.hypot(landing.x - enemies[0]!.x, landing.y - enemies[0]!.y) -
      16 -
      enemies[0]!.radius;
    expect(gap).toBeGreaterThanOrEqual(-0.01);
    expect(gap).toBeLessThan(8);
  });

  it("resolveBlinkLanding partial blink stops before a wall", () => {
    const bounds = { minX: -200, maxX: 200, minY: -200, maxY: 200 };
    const wall = { left: 40, top: -100, right: 200, bottom: 100 };
    const landing = resolveBlinkLanding(
      0,
      0,
      0,
      120,
      bounds,
      16,
      [wall],
      [],
      blinkResolve,
    );
    expect(landing.moved).toBe(true);
    expect(landing.x).toBeLessThan(40 - 16 + 1);
    expect(isBlinkLandingBlocked(landing.x, landing.y, 16, [wall], [])).toBe(false);
  });
});