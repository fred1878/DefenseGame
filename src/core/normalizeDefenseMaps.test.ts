import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import {
  normalizeDefenseMaps,
  resolveDefenseMap,
} from "./normalizeDefenseMaps";

function shippedDefenseMaps(): unknown {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "public/data/defense-maps.json"), "utf8"),
  );
}

describe("normalizeDefenseMaps", () => {
  it("rejects empty input", () => {
    expect(() => normalizeDefenseMaps({})).toThrow(ConfigLoadError);
  });

  it("loads shipped defense-maps.json", () => {
    const reg = normalizeDefenseMaps(
      shippedDefenseMaps() as import("./normalizeDefenseMaps").DefenseMapsFileInput,
    );
    expect(reg.maps.length).toBeGreaterThan(0);
    expect(reg.maps.some((m) => m.id === reg.defaultMapId)).toBe(true);
    expect(reg.maps[0]!.obstacles.length).toBeGreaterThan(0);
  });

  it("resolves default and named map ids", () => {
    const reg = normalizeDefenseMaps({
      defaultMapId: "b",
      maps: [
        {
          id: "a",
          field: { cols: 10, rows: 12 },
          obstacles: [
            { tileX: 1, tileY: 2, textureKey: "obstacle_wide_slab" },
          ],
        },
        {
          id: "b",
          field: { cols: 11, rows: 13 },
          obstacles: [
            { tileX: 3, tileY: 4, textureKey: "obstacle_tall_rock" },
          ],
        },
      ],
    });
    expect(resolveDefenseMap(reg).id).toBe("b");
    expect(resolveDefenseMap(reg, "a").field.cols).toBe(10);
  });
});