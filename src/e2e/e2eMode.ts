let cachedHref: string | null = null;
let cachedParams: URLSearchParams | null = null;

/**
 * Query params of the current page, re-parsed only when `location.href`
 * changes. Hot paths (per-frame E2E checks) must not allocate a `URL` each call.
 */
function pageQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const href = window.location.href;
  if (href !== cachedHref || !cachedParams) {
    cachedHref = href;
    cachedParams = new URL(href).searchParams;
  }
  return cachedParams.get(name);
}

/** Test / CI gate — never treat as prod gameplay. */
export function isE2EEnabled(): boolean {
  if (import.meta.env.VITE_E2E === "true") return true;
  return pageQueryParam("e2e") === "1";
}

export const E2E_SAVE_STORAGE_KEY = "defensegame-e2e-save";
export const E2E_SAVE_SLOT_KEY_PREFIX = "defensegame-e2e-save-slot-";
export const SAVE_SLOT_KEY_PREFIX = "defensegame_save_slot_";

export function saveStorageKey(): string {
  return isE2EEnabled() ? E2E_SAVE_STORAGE_KEY : "defensegame_save_v1";
}

/** localStorage key for a manual save slot (0-based). */
export function saveSlotStorageKey(index: number): string {
  const prefix = isE2EEnabled()
    ? E2E_SAVE_SLOT_KEY_PREFIX
    : SAVE_SLOT_KEY_PREFIX;
  return `${prefix}${index}`;
}

/** When set, e2e keeps Defense scene after night end until Return to town (Playwright UX spec). */
export function e2eManualReturnFromQuery(): boolean {
  return pageQueryParam("manualReturn") === "1";
}

/**
 * When set, e2e runs the campaign night's real wave (random spawns) instead of
 * an empty field — used by the win-model validation bot.
 */
export function e2eCampaignWavesFromQuery(): boolean {
  return pageQueryParam("campaignWaves") === "1";
}
