import { describe, expect, it } from "vitest";
import { optionalFiniteNumber } from "./configValidation";

describe("optionalFiniteNumber", () => {
  it("returns undefined when the value is omitted", () => {
    expect(optionalFiniteNumber(undefined, "path")).toBeUndefined();
  });
});
