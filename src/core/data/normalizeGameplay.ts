import {
  type NumberSections,
  numberSectionKeys,
  requireNumberSections,
  requireRecord,
} from "./configValidation";

/**
 * Boot-required sections of `public/data/gameplay.json`: global rules that have
 * no per-row home (wall HP, spawn band, wave labels, shared combat timings,
 * feel). Every key is a required finite number (see `DATA_FIELDS.md`).
 */
export const GAMEPLAY_SECTION_KEYS = {
  wall: ["baseHp", "hpPerLevel", "campaignWinWear"],
  nightEnd: ["winHealHp"],
  waves: ["eliteHpMul"],
  spawn: ["marginXWu", "southInsetWu", "jitterYWu"],
  combat: [
    "dotTickMs",
    "minSlowSpeedMul",
    "enemyKnockbackDecayMs",
    "knockbackWeightBaseline",
    "enemyProjectileKnockbackMul",
    "enemyProjectileHitSlackPx",
    "playerProjectileHitSlackPx",
    "lobOvershootPx",
    "lobMinTravelPx",
  ],
  audio: [
    "playerMeleeSlashVolume",
    "enemyMeleeSlashVolume",
    "fireWhooshVolume",
    "coinSpendVolume",
    "coinGainVolume",
    "uiPanelVolume",
    "uiClickVolume",
    "uiSellVolume",
    "uiEquipVolume",
    "uiUpgradeVolume",
    "uiErrorVolume",
  ],
  feel: [
    "novaFlashDurationMs",
    "novaFlashStartAlpha",
    "novaFlashScaleEnd",
    "impactTelegraphMs",
    "chainLightningHoldMs",
    "consumableToastHoldMs",
    "consumableToastFadeMs",
    "consumableToastRisePx",
    "townStatusMs",
    "resetConfirmWindowMs",
  ],
} as const;

export type GameplayTuning = NumberSections<typeof GAMEPLAY_SECTION_KEYS>;

/** Flat key names of {@link GAMEPLAY_SECTION_KEYS} (doc parity). */
export const GAMEPLAY_DOC_KEYS = numberSectionKeys(GAMEPLAY_SECTION_KEYS);

export function normalizeGameplay(raw: unknown): GameplayTuning {
  const root = requireRecord(raw, "gameplay");
  return requireNumberSections(root, GAMEPLAY_SECTION_KEYS, "gameplay");
}
