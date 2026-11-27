import { describe, expect, it } from "vitest";
import { TOWN_ISO_VIEW } from "../../config/townIsoView";
import { isoTileCenter } from "./isoGrid";
import {
  TOWN_ISO_PLAZA_TILE,
  tileNoise,
  townIsoGroundTiles,
  townIsoTerrainMap,
  townIsoTileFrame,
} from "./townIsoGround";
import { TOWN_ISO_STAGES } from "./townIsoStageData";
import type { TownIsoTerrain } from "./townIsoTypes";

const spec = TOWN_ISO_STAGES[2]!.ground;

describe("isometric town ground", () => {
  it("noise is deterministic and in 0..1", () => {
    expect(tileNoise(3, -4)).toBe(tileNoise(3, -4));
    expect(tileNoise(3, -4, 1)).not.toBe(tileNoise(3, -4));
    for (let i = -20; i < 20; i++) {
      const n = tileNoise(i, i * 3 - 7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it("paves the plaza and roads and leaves wild ground far out", () => {
    const map = townIsoTerrainMap(spec);
    const [pc, pr] = TOWN_ISO_PLAZA_TILE;
    expect(map.get(`${pc},${pr}`)).toBe(spec.plazaTile);
    expect([...map.values()]).toContain(spec.roadTile);
    const kinds = new Set(map.values());
    expect(kinds.has("grass") || kinds.has("grass_dry")).toBe(true);
  });

  it("covers the visible window with tiles sorted back to front", () => {
    const tiles = townIsoGroundTiles(TOWN_ISO_STAGES[0]!.ground);
    expect(tiles.length).toBeGreaterThan(1500);
    for (let i = 1; i < tiles.length; i++) {
      expect(tiles[i]!.y).toBeGreaterThanOrEqual(tiles[i - 1]!.y);
    }
    const V = TOWN_ISO_VIEW;
    const minX = Math.min(...tiles.map((t) => t.x));
    const maxY = Math.max(...tiles.map((t) => t.y));
    expect(minX).toBeLessThanOrEqual(V.viewX);
    expect(maxY + V.tileHeight).toBeGreaterThanOrEqual(V.viewY + V.viewHeight);
    expect(tiles.some((t) => /__/.test(t.frame))).toBe(true);
  });

  it("picks corner autotiles with NW = top corner bit 8", () => {
    const map = new Map<string, TownIsoTerrain>();
    for (let c = -2; c <= 2; c++) {
      for (let r = -2; r <= 2; r++) map.set(`${c},${r}`, "grass");
    }
    expect(townIsoTileFrame(map, 0, 0)).toMatch(/^grass_v[0-3]$/);
    // Dirt NW of tile (0,0): tiles (-1,-1), (0,-1), (-1,0) → vertex (0,0) is dirt.
    map.set("-1,-1", "dirt");
    map.set("0,-1", "dirt");
    map.set("-1,0", "dirt");
    expect(townIsoTileFrame(map, 0, 0)).toBe("grass__dirt_08");
    // Pair with no autotile set (dirt / flagstone) falls back to the tile's own base.
    for (const k of map.keys()) map.set(k, "dirt");
    for (const k of ["-1,-1", "0,-1", "-1,0"]) map.set(k, "flagstone");
    expect(townIsoTileFrame(map, 0, 0)).toMatch(/^dirt_v[0-3]$/);
    expect(townIsoTileFrame(map, 9, 9)).toBeNull();
    // Reversed pair name: cobble corners in dirt use dirt__cobble.
    for (const k of ["-1,-1", "0,-1", "-1,0"]) map.set(k, "cobble");
    expect(townIsoTileFrame(map, 0, 0)).toBe("dirt__cobble_08");
  });

  it("places tile (c, r) on the 2:1 grid", () => {
    expect(isoTileCenter(0, 0)).toEqual({ x: 540, y: 1600 });
    expect(isoTileCenter(1, 0)).toEqual({ x: 572, y: 1616 });
    expect(isoTileCenter(0, 1)).toEqual({ x: 508, y: 1616 });
  });
});
