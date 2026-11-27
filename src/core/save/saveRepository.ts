import { createNewSave, normalizeSave } from "./GameState";
import { migrateRawSave, type RawSave } from "./migrations";
import { SAVE_VERSION, type SaveGame } from "./saveTypes";
import { saveStorageKey } from "./storageKeys";

/**
 * Why a stored save could not be read. `newerVersion` blobs are kept in storage
 * (a newer build wrote them); the other failures are unrecoverable.
 */
export type SaveReadFailure =
  | "corrupt"
  | "invalidShape"
  | "unknownVersion"
  | "newerVersion"
  | "noMigration";

export type SaveReadResult =
  | { ok: true; save: SaveGame; savedAt: number | null }
  | { ok: false; reason: SaveReadFailure };

/** Minimum shape every save version shares (night and gold counters). */
export function isSaveShape(value: unknown): value is RawSave {
  if (typeof value !== "object" || value === null) return false;
  const save = value as Record<string, unknown>;
  return typeof save.night === "number" && typeof save.gold === "number";
}

/**
 * The one validator for stored saves (autosave and slots): parse the
 * `{ version, save, savedAt? }` envelope, check the shape, run the migration
 * chain up to the current version, then normalize.
 */
export function parseStoredSave(raw: string): SaveReadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "corrupt" };
  }
  const blob = parsed as {
    version?: unknown;
    save?: unknown;
    savedAt?: unknown;
  };
  if (!isSaveShape(blob.save)) return { ok: false, reason: "invalidShape" };
  const migrated = migrateRawSave(blob.version, blob.save);
  if (!migrated.ok) return { ok: false, reason: migrated.reason };
  const savedAt =
    typeof blob.savedAt === "number" && Number.isFinite(blob.savedAt)
      ? blob.savedAt
      : null;
  return {
    ok: true,
    save: normalizeSave(migrated.save as unknown as SaveGame),
    savedAt,
  };
}

/** True when a failed read should leave the stored blob in place. */
export function keepUnreadableSave(reason: SaveReadFailure): boolean {
  return reason === "newerVersion";
}

/**
 * Read the autosave. Older versions are migrated; an empty, corrupt or
 * unreadable autosave starts a new game (a newer-version blob is left alone
 * until the next `persistSave`).
 */
export function loadSave(): SaveGame {
  if (typeof localStorage === "undefined") return createNewSave();
  const raw = localStorage.getItem(saveStorageKey());
  if (!raw) return createNewSave();
  const read = parseStoredSave(raw);
  return read.ok ? read.save : createNewSave();
}

export function persistSave(save: SaveGame): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    saveStorageKey(),
    JSON.stringify({ version: SAVE_VERSION, save }),
  );
}

/** Wipes save and reloads (mobile-friendly substitute for hard refresh). */
export function resetSaveAndReload(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(saveStorageKey());
  }
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("fresh", String(Date.now()));
  window.location.replace(url.toString());
}
