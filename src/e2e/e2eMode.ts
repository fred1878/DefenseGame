/** Test / CI gate — never treat as prod gameplay. */
export function isE2EEnabled(): boolean {
  if (import.meta.env.VITE_E2E === "true") return true;
  if (typeof window === "undefined") return false;
  return new URL(window.location.href).searchParams.get("e2e") === "1";
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
  if (typeof window === "undefined") return false;
  return new URL(window.location.href).searchParams.get("manualReturn") === "1";
}
