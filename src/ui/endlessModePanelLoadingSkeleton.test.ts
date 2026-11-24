import { describe, expect, it } from "vitest";
import { ENDLESS_PANEL_LOADING_SKELETON_ROWS } from "./EndlessModePanelLoadingSkeleton";

describe("EndlessModePanelLoadingSkeleton", () => {
  it("shows a modest fixed row count while loading", () => {
    expect(ENDLESS_PANEL_LOADING_SKELETON_ROWS).toBeGreaterThanOrEqual(3);
    expect(ENDLESS_PANEL_LOADING_SKELETON_ROWS).toBeLessThanOrEqual(8);
  });
});