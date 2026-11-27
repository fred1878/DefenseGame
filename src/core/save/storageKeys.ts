/**
 * localStorage keys for the autosave and manual save slots.
 *
 * E2E runs use separate keys so Playwright never touches a real save. The
 * E2E check is injected by `gameMain` (`setE2EStorageIsolation`) so core save
 * code does not import `e2e/`. Until it is installed, production keys are used.
 */
const SAVE_STORAGE_KEY = "defensegame_save_v1";
const SAVE_SLOT_KEY_PREFIX = "defensegame_save_slot_";
export const E2E_SAVE_STORAGE_KEY = "defensegame-e2e-save";
const E2E_SAVE_SLOT_KEY_PREFIX = "defensegame-e2e-save-slot-";

let isE2EStorage: () => boolean = () => false;

/** Install the E2E-mode check (called once at boot by `gameMain`). */
export function setE2EStorageIsolation(check: () => boolean): void {
  isE2EStorage = check;
}

export function saveStorageKey(): string {
  return isE2EStorage() ? E2E_SAVE_STORAGE_KEY : SAVE_STORAGE_KEY;
}

/** localStorage key for a manual save slot (0-based). */
export function saveSlotStorageKey(index: number): string {
  const prefix = isE2EStorage()
    ? E2E_SAVE_SLOT_KEY_PREFIX
    : SAVE_SLOT_KEY_PREFIX;
  return `${prefix}${index}`;
}
