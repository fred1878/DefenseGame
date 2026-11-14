import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import {
  isTouchButtonVisuallyPressed,
  pointerInScreenRect,
} from "./touchButton";

describe("pointerInScreenRect", () => {
  const rect = { x: 100, y: 200, width: 80, height: 40 };

  it("accepts interior points", () => {
    expect(pointerInScreenRect(140, 220, rect)).toBe(true);
  });

  it("accepts edges", () => {
    expect(pointerInScreenRect(100, 200, rect)).toBe(true);
    expect(pointerInScreenRect(180, 240, rect)).toBe(true);
  });

  it("rejects outside", () => {
    expect(pointerInScreenRect(99, 220, rect)).toBe(false);
    expect(pointerInScreenRect(181, 220, rect)).toBe(false);
  });
});

describe("isTouchButtonVisuallyPressed", () => {
  it("detects press-scale and rest states", () => {
    const container = {
      scaleX: 1,
      scaleY: 1,
    } as Phaser.GameObjects.Container;
    expect(isTouchButtonVisuallyPressed(container)).toBe(false);
    container.scaleX = 0.88;
    container.scaleY = 0.88;
    expect(isTouchButtonVisuallyPressed(container)).toBe(true);
  });
});