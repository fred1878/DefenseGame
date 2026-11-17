import { describe, expect, it } from "vitest";
import { urlBuildParamLine } from "./buildId";

describe("urlBuildParamLine", () => {
  it("returns null when b param absent", () => {
    expect(urlBuildParamLine("abc123", null)).toBeNull();
  });

  it("marks match when b equals embedded", () => {
    expect(urlBuildParamLine("deadbeef", "deadbeef")).toBe(
      "URL b=deadbeef · match",
    );
  });

  it("marks mismatch when b differs from embedded", () => {
    expect(urlBuildParamLine("newsha", "oldsha")).toBe(
      "URL b=oldsha · mismatch",
    );
  });
});