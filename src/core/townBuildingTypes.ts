export type TownBuildingDef = {
  label: string;
  textureKey: string;
  width: number;
  height: number;
  /** When set, menu tap runs `buildings.json` upgrade for this id. */
  upgradeId?: string;
  /** When true, tap starts Defense night (e.g. Gallows Square). */
  startsNight?: boolean;
  /** When true, tap opens town Spell bar sort panel (e.g. daylit Witchlight Beacon). */
  opensSpellBar?: boolean;
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