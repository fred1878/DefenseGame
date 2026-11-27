/**
 * Isometric town growth: town level, growth stage and which art tier each building shows.
 *
 * PLACEHOLDER VALUES — NOT GAME NUMBERS. The game has no real "town level" yet. These
 * thresholds only decide how the town LOOKS (ruined camp → market town → walled town) and
 * the "Town Lv" read-out in the town HUD. They are not economy or balance numbers and nothing
 * in combat, shops or saves depends on them. Replace them when a real town-level design lands.
 *
 * Town level is derived from the existing building upgrade levels in the save
 * (`save.buildings`, e.g. wall + trader + blacksmith from `buildings.json`); nothing new is saved.
 */
export const TOWN_GROWTH_PLACEHOLDER = {
  /** `buildings.json` ids whose levels add up to the town growth score. */
  scoreBuildingIds: ["wall", "trader", "blacksmith"],
  /** Minimum growth score for Town Lv 1, 2, 3… (index + 1 = level). PLACEHOLDER. */
  townLevelMinScore: [0, 2, 5, 8, 11, 14],
  /** Minimum town level for growth stage 1, 2 and 3. PLACEHOLDER. */
  stageMinTownLevel: [1, 3, 5],
  /**
   * Art tier (0..2) per building level, for buildings with an upgrade or shop level:
   * entry i = minimum level for tier i. Other buildings follow the town stage. PLACEHOLDER.
   */
  artTierMinLevel: {
    wall: [0, 3, 6],
    trader: [0, 2, 3],
    blacksmith: [0, 2, 3],
  },
} as const;

/** Display names for the growth stages (HUD subtitle). */
export const TOWN_STAGE_NAMES = [
  "Ruined Camp",
  "Market Town",
  "Walled Town",
] as const;
