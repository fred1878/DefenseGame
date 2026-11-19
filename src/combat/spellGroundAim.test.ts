import { describe, expect, it } from "vitest";
import {
  resolveAutoCastGroundAim,
  resolveManualDefaultGroundAim,
} from "./spellGroundAim";

const enemies = [
  { id: "near", x: 80, y: 0, radius: 10, alive: true },
  { id: "far", x: 400, y: 0, radius: 10, alive: true },
  { id: "side", x: 0, y: 60, radius: 10, alive: true },
];

describe("resolveAutoCastGroundAim", () => {
  it("aims at focused enemy in strike range", () => {
    const aim = resolveAutoCastGroundAim(
      0,
      0,
      0,
      "side",
      enemies,
      "ranged",
      50,
      120,
      240,
    );
    expect(aim.x).toBe(0);
    expect(aim.y).toBe(60);
  });

  it("uses nearest in strike range when no focus", () => {
    const aim = resolveAutoCastGroundAim(
      0,
      0,
      0,
      null,
      enemies,
      "ranged",
      50,
      120,
      240,
    );
    expect(aim.x).toBe(0);
    expect(aim.y).toBe(60);
  });

  it("falls back to nearest within ground range when outside strike range", () => {
    const aim = resolveAutoCastGroundAim(
      0,
      0,
      0,
      null,
      [{ id: "far", x: 200, y: 0, radius: 10, alive: true }],
      "ranged",
      50,
      80,
      240,
    );
    expect(aim.x).toBe(200);
    expect(aim.y).toBe(0);
  });

  it("ignores focus outside strike range and picks nearest in range", () => {
    const aim = resolveAutoCastGroundAim(
      0,
      0,
      0,
      "far",
      enemies,
      "ranged",
      50,
      120,
      240,
    );
    expect(aim.x).toBe(0);
    expect(aim.y).toBe(60);
  });

  it("clamps aim to ground max range", () => {
    const aim = resolveAutoCastGroundAim(
      0,
      0,
      0,
      "x",
      [{ id: "x", x: 150, y: 0, radius: 10, alive: true }],
      "ranged",
      200,
      200,
      100,
    );
    expect(aim.x).toBe(100);
    expect(aim.y).toBe(0);
  });

  it("places target at max range toward enemy beyond ground max range", () => {
    const aim = resolveAutoCastGroundAim(
      0,
      0,
      0,
      null,
      [{ id: "far", x: 500, y: 0, radius: 10, alive: true }],
      "ranged",
      50,
      80,
      240,
    );
    expect(aim.x).toBe(240);
    expect(aim.y).toBe(0);
  });

  it("does not use facing offset when a living enemy exists beyond ground max range", () => {
    const facingRad = Math.PI / 2;
    const aim = resolveAutoCastGroundAim(
      0,
      0,
      facingRad,
      null,
      [{ id: "far", x: 0, y: 400, radius: 10, alive: true }],
      "ranged",
      50,
      80,
      100,
    );
    expect(aim.x).toBe(0);
    expect(aim.y).toBe(100);
  });
});

describe("resolveManualDefaultGroundAim", () => {
  it("uses focused enemy position then clamps to ground max range", () => {
    const aim = resolveManualDefaultGroundAim(0, 0, 0, "far", enemies, 240);
    expect(aim.x).toBe(240);
    expect(aim.y).toBe(0);
  });

  it("snaps to nearest living enemy in ground range when no focus", () => {
    const aim = resolveManualDefaultGroundAim(0, 0, 0, null, enemies, 240);
    expect(aim.x).toBe(0);
    expect(aim.y).toBe(60);
  });
});