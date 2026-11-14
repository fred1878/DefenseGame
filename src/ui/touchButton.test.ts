import { describe, expect, it } from "vitest";
import { pointerInScreenRect } from "./touchButton";

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