import { describe, expect, it } from "vitest";
import {
  CODE_DEFENSE_OBSTACLE_PLACEMENTS,
  normalizeDefenseMaps,
  resolveDefenseMap,
} from "./normalizeDefenseMaps";

describe("normalizeDefenseMaps", () => {
  it("falls back to code map when JSON is empty", () => {
    const reg = normalizeDefenseMaps({});
    expect(reg.maps).toHaveLength(1);
    expect(reg.defaultMapId).toBe("night-field");
    expect(reg.maps[0]!.obstacles).toHaveLength(
      CODE_DEFENSE_OBSTACLE_PLACEMENTS.length,
    );
  });

  it("resolves default and named map ids", () => {
    const reg = normalizeDefenseMaps({
      defaultMapId: "b",
      maps: [
        { id: "a", field: { cols: 10, rows: 12 }, obstacles: [] },
        { id: "b", field: { cols: 11, rows: 13 }, obstacles: [] },
      ],
    });
    expect(resolveDefenseMap(reg).id).toBe("b");
    expect(resolveDefenseMap(reg, "a").field.cols).toBe(10);
  });
});