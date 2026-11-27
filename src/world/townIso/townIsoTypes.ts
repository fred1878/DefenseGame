/** Growth stage index: 0 = ruined camp, 1 = market town, 2 = walled town. */
export type TownStageIndex = 0 | 1 | 2;

/** Optional per-item flags on a scenery row. */
export type TownIsoSceneryFlags = { flip?: boolean; scale?: number };

/** [spriteKey, worldX, worldY (foot pivot), tint (fog / value grade as 0xRRGGBB), flags?]. */
export type TownIsoSceneryRow =
  | readonly [string, number, number, number]
  | readonly [string, number, number, number, TownIsoSceneryFlags];

export type TownIsoLightColor = "warm" | "witch" | "moon" | "sick" | "gold";

/** [worldX, worldY, colour, radius (world px), strength 0..1]. */
export type TownIsoLight = readonly [
  number,
  number,
  TownIsoLightColor,
  number,
  number,
];

export type TownIsoTerrain =
  | "grass"
  | "grass_dry"
  | "dirt"
  | "mud"
  | "cobble"
  | "flagstone";

/** Ground rules for one stage (town footprint ellipse, plaza and road surfaces). */
export type TownIsoGroundSpec = {
  /** Footprint ellipse centre Y and radii (world px); centre X is the map centre. */
  cy: number;
  ax: number;
  ay: number;
  /** Plaza half-size in tiles around the Gallows Square tile. */
  plazaRadius: number;
  plazaTile: TownIsoTerrain;
  roadTile: TownIsoTerrain;
  townTile: TownIsoTerrain;
  /** How many of the road targets (in order) are linked to the plaza. */
  roadTargets: number;
};

export type TownIsoStageData = {
  ground: TownIsoGroundSpec;
  scenery: readonly TownIsoSceneryRow[];
  lights: readonly TownIsoLight[];
  /** Chimney smoke sources (world px). */
  smoke: readonly (readonly [number, number])[];
};

/** One art tier of a tappable building. */
export type TownIsoBuildingTier = {
  key: string;
  /** Offset of the sprite pivot from the layout slot foot (world px). */
  dx: number;
  dy: number;
  /** Footprint in tiles (contact shadow size). */
  footprint: readonly [number, number];
};
