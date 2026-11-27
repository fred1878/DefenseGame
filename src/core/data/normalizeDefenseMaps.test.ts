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
    readFileSync(
      path.join(process.cwd(), "public/data/defense-maps.json"),
      "utf8",
    ),
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
          obstacles: [{ tileX: 1, tileY: 2, textureKey: "obstacle_wide_slab" }],
        },
        {
          id: "b",
          field: { cols: 11, rows: 13 },
          obstacles: [{ tileX: 3, tileY: 4, textureKey: "obstacle_tall_rock" }],
        },
      ],
    });
    expect(resolveDefenseMap(reg).id).toBe("b");
    expect(resolveDefenseMap(reg, "a").field.cols).toBe(10);
  });
});

describe("normalizeDefenseMaps validation", () => {
  const validObstacle = {
    tileX: 1,
    tileY: 2,
    textureKey: "obstacle_wide_slab",
  };

  function validMaps(overrides: Record<string, unknown> = {}) {
    return {
      defaultMapId: "a",
      maps: [
        {
          id: "a",
          field: { cols: 10, rows: 12 },
          obstacles: [validObstacle],
        },
      ],
      ...overrides,
    };
  }

  it("rejects an unknown obstacle texture", () => {
    expect(() =>
      normalizeDefenseMaps(
        validMaps({
          maps: [
            {
              id: "a",
              field: { cols: 10, rows: 12 },
              obstacles: [{ ...validObstacle, textureKey: "not_a_texture" }],
            },
          ],
        }),
      ),
    ).toThrow(/textureKey/);
  });

  it("rejects a blank map id, a zero-size field, and empty obstacles", () => {
    expect(() =>
      normalizeDefenseMaps(
        validMaps({
          maps: [
            {
              id: "  ",
              field: { cols: 10, rows: 12 },
              obstacles: [validObstacle],
            },
          ],
        }),
      ),
    ).toThrow(/id/);
    expect(() =>
      normalizeDefenseMaps(
        validMaps({
          maps: [
            {
              id: "a",
              field: { cols: 0, rows: 12 },
              obstacles: [validObstacle],
            },
          ],
        }),
      ),
    ).toThrow(/field/);
    expect(() =>
      normalizeDefenseMaps(
        validMaps({
          maps: [{ id: "a", field: { cols: 10, rows: 12 }, obstacles: [] }],
        }),
      ),
    ).toThrow(/obstacles/);
  });

  it("rejects a missing or unknown default map id", () => {
    expect(() =>
      normalizeDefenseMaps(validMaps({ defaultMapId: "  " })),
    ).toThrow(/defaultMapId/);
    expect(() =>
      normalizeDefenseMaps(validMaps({ defaultMapId: "missing" })),
    ).toThrow(/not found/);
  });

  it("throws when resolving an id that is not in the registry", () => {
    const reg = normalizeDefenseMaps(validMaps());
    expect(() => resolveDefenseMap(reg, "nope")).toThrow(/not found/);
  });
});
