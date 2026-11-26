import { describe, expect, it } from "vitest";
import {
  getEmbeddedBuildId,
  shortBuildIdLabel,
  townBuildIdLine,
} from "./buildId";

describe("shortBuildIdLabel", () => {
  it("keeps short ids intact", () => {
    expect(shortBuildIdLabel("local")).toBe("local");
  });

  it("truncates long hashes to 8 chars", () => {
    expect(shortBuildIdLabel("deadbeefcafebabe")).toBe("deadbeef");
  });
});

describe("townBuildIdLine", () => {
  it("shows build only when b param absent", () => {
    expect(townBuildIdLine("abc123", null)).toBe("Build abc123");
  });

  it("marks match when b equals embedded", () => {
    expect(townBuildIdLine("deadbeef", "deadbeef")).toBe(
      "Build deadbeef · match",
    );
  });

  it("marks mismatch when b differs from embedded", () => {
    expect(townBuildIdLine("newsha", "oldsha")).toBe("Build newsha · mismatch");
  });
});

describe("getEmbeddedBuildId", () => {
  it("returns a non-empty build id", () => {
    const id = getEmbeddedBuildId();
    expect(id.length).toBeGreaterThan(0);
  });
});
