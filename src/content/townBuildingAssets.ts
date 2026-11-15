/** v02 town building PNGs under `public/assets/town/buildings/`. */

export const TOWN_BUILDING_ASSET_ROOT = "assets/town/buildings";

/**
 * Peter keep list (2026-11-15): night-only specials + dual day/night market stall & witchlight beacon.
 * Day variants use distinct texture keys (`*_daylit`); night-only entries keep `town_special_*` keys.
 */
export const TOWN_BUILDING_ASSETS = [
  { key: "town_special_gallows_square", file: "town_special_gallows_square.png" },
  { key: "town_special_haunted_well", file: "town_special_haunted_well.png" },
  { key: "town_special_moon_brazier", file: "town_special_moon_brazier.png" },
  { key: "town_special_plague_clinic", file: "town_special_plague_clinic.png" },
  { key: "town_market_stall", file: "town_market_stall.png" },
  { key: "town_market_stall_daylit", file: "town_market_stall_daylit.png" },
  { key: "town_special_witchlight_beacon", file: "town_special_witchlight_beacon.png" },
  {
    key: "town_special_witchlight_beacon_daylit",
    file: "town_special_witchlight_beacon_daylit.png",
  },
] as const;

export type TownBuildingTextureKey =
  (typeof TOWN_BUILDING_ASSETS)[number]["key"];