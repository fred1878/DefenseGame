import { describe, expect, it } from "vitest";
import { townMetaOverlayBlocksBuildingInput } from "./townMetaOverlayInput";

describe("townMetaOverlayBlocksBuildingInput", () => {
  const closed = {
    spellSortPanel: null,
    endlessPanel: null,
    wavePlannerPanel: null,
  };

  it("is false when no town meta overlay is open", () => {
    expect(townMetaOverlayBlocksBuildingInput(closed)).toBe(false);
  });

  it("is true when the spell sort panel is open", () => {
    expect(
      townMetaOverlayBlocksBuildingInput({ ...closed, spellSortPanel: {} }),
    ).toBe(true);
  });

  it("is true when endless or wave planner overlay is open", () => {
    expect(
      townMetaOverlayBlocksBuildingInput({ ...closed, endlessPanel: {} }),
    ).toBe(true);
    expect(
      townMetaOverlayBlocksBuildingInput({ ...closed, wavePlannerPanel: {} }),
    ).toBe(true);
  });
});