import { afterEach, describe, expect, it, vi } from "vitest";
import { createRng, pickWeighted, randInt, randomSeed } from "./rng";

describe("rng", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is deterministic per seed and stays in [0, 1)", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("randInt is inclusive and order-insensitive", () => {
    const seen = new Set<number>();
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) seen.add(randInt(rng, 3, 1));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("pickWeighted honours weights and skips zero weights", () => {
    expect(
      pickWeighted(
        () => 0,
        ["a", "b"],
        () => 0,
      ),
    ).toBeUndefined();
    expect(
      pickWeighted(
        () => 0.99,
        ["a", "b"],
        (x) => (x === "a" ? 1 : 0),
      ),
    ).toBe("a");
    expect(
      pickWeighted(
        () => 0.6,
        ["a", "b"],
        () => 1,
      ),
    ).toBe("b");
    // Rounding guard: a roll of exactly 1 still returns the last positive item.
    expect(
      pickWeighted(
        () => 1,
        ["a", "b", "c"],
        (x) => (x === "c" ? 0 : 1),
      ),
    ).toBe("b");
  });

  it("randomSeed uses Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(randomSeed()).toBe(Math.floor(0.5 * 0x7fffffff));
  });
});
