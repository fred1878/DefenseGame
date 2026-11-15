export type TownBuildingDef = {
  label: string;
  textureKey: string;
  width: number;
  height: number;
  /** When set, menu tap runs `buildings.json` upgrade for this id. */
  upgradeId?: string;
  /** When true, tap starts Defense night (e.g. Gallows Square). */
  startsNight?: boolean;
};

export type TownLayoutSlot = {
  buildingId: string;
  x: number;
  y: number;
};

export type TownLayoutDef = {
  slots: TownLayoutSlot[];
  /** Bottom-to-top menu order after Start night (defaults to sorted building ids). */
  menuOrder?: string[];
};