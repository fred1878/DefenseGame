import { TOWN_ISO_VIEW } from "../../config/townIsoView";
import { isoTileCenter } from "./isoGrid";
import type { TownIsoGroundSpec, TownIsoTerrain } from "./townIsoTypes";

/** Tile of the Gallows Square plaza centre. */
export const TOWN_ISO_PLAZA_TILE = [1, 1] as const;

/**
 * Road ends, in the order roads are laid as the town grows: Witchlight Beacon, Haunted
 * Well, daylit Beacon, Plague Clinic, Night Market, Daylit Market, Moon Brazier, gate.
 */
const ROAD_TARGETS: readonly (readonly [number, number])[] = [
  [-22, -22],
  [-22, -13],
  [-12, -22],
  [-2, -12],
  [-10, -1],
  [1, 10],
  [10, 1],
  [18, 18],
];

/** Corner autotile sets in the ground atlas (`<a>__<b>_NN`). */
const AUTOTILE_PAIRS: ReadonlySet<string> = new Set([
  "grass__dirt",
  "grass_dry__dirt",
  "grass__mud",
  "dirt__cobble",
  "grass__cobble",
  "grass__flagstone",
]);

/** Base tile variants in the ground atlas (`<terrain>_v<n>`). */
const VARIANTS: Readonly<Record<TownIsoTerrain, number>> = {
  grass: 4,
  grass_dry: 4,
  dirt: 4,
  mud: 4,
  cobble: 1,
  flagstone: 1,
};

/** Tie-break when corner votes are even: built surfaces win over wild ground. */
const PRIORITY: Readonly<Record<TownIsoTerrain, number>> = {
  grass: 0,
  grass_dry: 1,
  dirt: 2,
  mud: 3,
  cobble: 4,
  flagstone: 5,
};

const key = (c: number, r: number): string => `${c},${r}`;

/** Deterministic 0..1 noise per tile (and salt). */
export function tileNoise(c: number, r: number, salt = 0): number {
  let h = Math.imul(c | 0, 374761393) ^ Math.imul(r | 0, 668265263);
  h = Math.imul(h ^ Math.imul(salt + 1, 2246822519), 3266489917);
  h ^= h >>> 15;
  h = Math.imul(h, 2654435761);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967295;
}

/** L-shaped road from `a` to `b`, `w` tiles wide (along c first, then r). */
function lineTiles(
  a: readonly [number, number],
  b: readonly [number, number],
  w: number,
  out: Set<string>,
): void {
  const [c0, r0] = a;
  const [c1, r1] = b;
  for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) {
    for (let k = 0; k < w; k++) out.add(key(c, r0 + k));
  }
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) {
    for (let k = 0; k < w; k++) out.add(key(c1 + k, r));
  }
}

/** Terrain of every tile in the visible window, keyed "c,r". */
export function townIsoTerrainMap(
  spec: TownIsoGroundSpec,
): Map<string, TownIsoTerrain> {
  const [pc, pr] = TOWN_ISO_PLAZA_TILE;
  const roads = new Set<string>();
  for (const t of ROAD_TARGETS.slice(0, spec.roadTargets)) {
    lineTiles(TOWN_ISO_PLAZA_TILE, t, 2, roads);
  }
  const V = TOWN_ISO_VIEW;
  const out = new Map<string, TownIsoTerrain>();
  for (let u = -110; u < 70; u++) {
    for (let v = -22; v <= 22; v++) {
      if ((u + v) % 2 !== 0) continue;
      const c = (u + v) / 2;
      const r = (u - v) / 2;
      const { x, y } = isoTileCenter(c, r);
      if (
        x < V.viewX - V.tileWidth ||
        x > V.viewX + V.viewWidth + V.tileWidth ||
        y < V.viewY - V.tileHeight ||
        y > V.viewY + V.viewHeight + V.tileHeight
      ) {
        continue;
      }
      const e =
        ((x - V.originX) / spec.ax) ** 2 + ((y - spec.cy) / spec.ay) ** 2;
      const n = tileNoise(c, r);
      let t: TownIsoTerrain;
      if (
        Math.abs(c - pc) <= spec.plazaRadius &&
        Math.abs(r - pr) <= spec.plazaRadius
      ) {
        t = spec.plazaTile;
      } else if (roads.has(key(c, r))) {
        t = e < 1.05 ? spec.roadTile : "dirt";
      } else if (e < 1 - 0.25 * n) {
        t = spec.townTile;
      } else if (e < 1.25 + 0.3 * n) {
        t = n > 0.5 ? "mud" : "dirt";
      } else {
        t = n > 0.35 ? "grass_dry" : "grass";
      }
      out.set(key(c, r), t);
    }
  }
  return out;
}

/** Terrain at grid vertex (i, j): majority of the (up to) four tiles touching it. */
function vertexTerrain(
  map: ReadonlyMap<string, TownIsoTerrain>,
  i: number,
  j: number,
): TownIsoTerrain | undefined {
  const votes = new Map<TownIsoTerrain, number>();
  for (const [c, r] of [
    [i - 1, j - 1],
    [i, j - 1],
    [i - 1, j],
    [i, j],
  ] as const) {
    const t = map.get(key(c, r));
    if (t) votes.set(t, (votes.get(t) ?? 0) + 1);
  }
  let best: TownIsoTerrain | undefined;
  let bestN = 0;
  for (const [t, n] of votes) {
    if (
      n > bestN ||
      (n === bestN && best !== undefined && PRIORITY[t] > PRIORITY[best])
    ) {
      best = t;
      bestN = n;
    }
  }
  return best;
}

/**
 * Atlas frame for tile (c, r): a corner autotile (Antahonist `a__b_NN`, NN = NW*8 + NE*4 +
 * SE*2 + SW*1 with NW the top corner) when its corners mix two terrains that have a set,
 * otherwise the tile's own base terrain with a noise-picked variant.
 */
export function townIsoTileFrame(
  map: ReadonlyMap<string, TownIsoTerrain>,
  c: number,
  r: number,
): string | null {
  const own = map.get(key(c, r));
  if (!own) return null;
  const corners = [
    vertexTerrain(map, c, r),
    vertexTerrain(map, c + 1, r),
    vertexTerrain(map, c + 1, r + 1),
    vertexTerrain(map, c, r + 1),
  ].map((t) => t ?? own);
  const kinds = [...new Set(corners)];
  if (kinds.length === 2) {
    const [x, y] = kinds as [TownIsoTerrain, TownIsoTerrain];
    for (const [a, b] of [
      [x, y],
      [y, x],
    ] as const) {
      if (!AUTOTILE_PAIRS.has(`${a}__${b}`)) continue;
      const bits = corners.reduce(
        (acc, t, idx) => acc | (t === b ? 8 >> idx : 0),
        0,
      );
      return `${a}__${b}_${String(bits).padStart(2, "0")}`;
    }
  }
  const base = kinds.length === 1 ? (kinds[0] as TownIsoTerrain) : own;
  const variant = Math.floor(tileNoise(c, r, 1) * VARIANTS[base]);
  return `${base}_v${Math.min(variant, VARIANTS[base] - 1)}`;
}

export type TownIsoGroundTile = { frame: string; x: number; y: number };

/** Ground tiles for a stage, back to front, with each tile's top-left in world px. */
export function townIsoGroundTiles(
  spec: TownIsoGroundSpec,
): TownIsoGroundTile[] {
  const map = townIsoTerrainMap(spec);
  const out: TownIsoGroundTile[] = [];
  const V = TOWN_ISO_VIEW;
  for (const k of map.keys()) {
    const [c, r] = k.split(",").map(Number) as [number, number];
    const frame = townIsoTileFrame(map, c, r);
    if (!frame) continue;
    const { x, y } = isoTileCenter(c, r);
    out.push({ frame, x: x - V.tileWidth / 2, y: y - V.tileHeight / 2 });
  }
  out.sort((a, b) => a.y - b.y || a.x - b.x);
  return out;
}
