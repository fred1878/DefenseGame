import Phaser from "phaser";
import { describe, expect, it, vi, afterEach } from "vitest";
import { defensePlayerStart, pickWaveSpawnPoint } from "./defenseSpawns";
import { fakeScene } from "../test/fakeScene";

describe("defenseSpawns", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pins spawn Y in e2e mode", () => {
    const point = pickWaveSpawnPoint(true);
    expect(point.x).toBe(0);
    expect(point.y).toBeGreaterThan(0);
  });

  it("jitters spawn within the south band in production", () => {
    vi.spyOn(Phaser.Math, "Between").mockImplementation(
      (a: number, b: number) => (a + b) / 2,
    );
    const { registry } = fakeScene();
    const point = pickWaveSpawnPoint(false, registry as never);
    expect(Math.abs(point.x)).toBeLessThan(500);
    expect(point.y).toBeGreaterThan(0);
  });

  it("returns player origin for defense start", () => {
    expect(defensePlayerStart()).toEqual({ x: 0, y: 0 });
  });
});
