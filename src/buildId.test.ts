import { describe, expect, it } from "vitest";
import { shortBuildIdLabel, urlBuildParamLine } from "./buildId";

describe("shortBuildIdLabel", () => {
  it("keeps short ids intact", () => {
    expect(shortBuildIdLabel("local")).toBe("local");
  });

  it("truncates long hashes to 8 chars", () => {
    expect(shortBuildIdLabel("deadbeefcafebabe")).toBe("deadbeef");
  });
});

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