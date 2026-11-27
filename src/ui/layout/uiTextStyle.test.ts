import { describe, expect, it } from "vitest";
import { parseUiFontSizePx } from "./uiTextStyle";

describe("parseUiFontSizePx", () => {
  it("returns zero when the size is not a finite number", () => {
    expect(parseUiFontSizePx("12px")).toBe(12);
    expect(parseUiFontSizePx("nope")).toBe(0);
  });
});
