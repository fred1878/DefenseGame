export type TownBuildingDef = {
  /** Name on the building's town name plate. */
  label: string;
  /** Minimum tap box (town screen px); the art tier's sprite usually sets a larger one. */
  width: number;
  height: number;
  /** When set, menu tap runs `buildings.json` upgrade for this id. */
  upgradeId?: string;
  /** When true, tap starts Defense night (e.g. Gallows Square). */
  startsNight?: boolean;
  /** When true, tap opens town Spell bar sort panel (e.g. daylit Witchlight Beacon). */
  opensSpellBar?: boolean;
  /** When true, tap opens endless enemy training panel (e.g. Haunted Well). */
  opensEndlessMode?: boolean;
  /** When true, tap opens custom wave planner (e.g. Plague Clinic). */
  opensWavePlanner?: boolean;
  /** When true, tap opens the manual save-slot menu (e.g. daylit Market Stall). */
  opensSaveMenu?: boolean;
  /** Opens a `shops.json` shop: `trader` (night Market Stall) or `blacksmith` (Moon Brazier). */
  opensShop?: "trader" | "blacksmith";
};

export type TownLayoutSlot = {
  buildingId: string;
  x: number;
  y: number;
};

export type TownLayoutDef = {
  /** Extra size multiplier for building sprites on top of the isometric town scale. */
  buildingDisplayScale: number;
  slots: TownLayoutSlot[];
};
