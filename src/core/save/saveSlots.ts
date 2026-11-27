import { SAVE_VERSION, type SaveGame } from "./saveTypes";
import { saveSlotStorageKey } from "./storageKeys";
import { normalizeSave } from "./GameState";
import { keepUnreadableSave, parseStoredSave } from "./saveRepository";

export const SAVE_SLOT_COUNT = 5;

export type EmptySaveSlotView = {
  index: number;
  name: string;
  empty: true;
};

export type OccupiedSaveSlotView = {
  index: number;
  name: string;
  empty: false;
  night: number;
  gold: number;
  savedAt: number;
};

export type SaveSlotView = EmptySaveSlotView | OccupiedSaveSlotView;

export function saveSlotName(index: number): string {
  return `Slot ${index + 1}`;
}

export function formatSaveSlotTimestamp(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "Unknown time";
  const d = new Date(ms);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getMonth()] ?? "Jan";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${month} ${d.getFullYear()}, ${hh}:${mm}`;
}

export function formatSaveSlotMeta(slot: SaveSlotView): string {
  if (slot.empty) return "Empty";
  return `Night ${slot.night} · ${slot.gold}g\n${formatSaveSlotTimestamp(slot.savedAt)}`;
}

function emptySlot(index: number): EmptySaveSlotView {
  return { index, name: saveSlotName(index), empty: true };
}

/**
 * Read and validate one slot through {@link parseStoredSave}: older versions
 * are migrated, corrupt or invalid blobs are deleted, and a blob written by a
 * newer build is kept in storage but reported as unreadable (null).
 */
function readSlotSave(
  index: number,
): { save: SaveGame; savedAt: number | null } | null {
  if (typeof localStorage === "undefined") return null;
  const key = saveSlotStorageKey(index);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const read = parseStoredSave(raw);
  if (read.ok) return read;
  if (!keepUnreadableSave(read.reason)) localStorage.removeItem(key);
  return null;
}

/** Slot summary for the save menu, or null when empty / unreadable. */
export function readSaveSlot(index: number): OccupiedSaveSlotView | null {
  const read = readSlotSave(index);
  if (!read) return null;
  return {
    index,
    name: saveSlotName(index),
    empty: false,
    night: read.save.night,
    gold: read.save.gold,
    savedAt: read.savedAt ?? 0,
  };
}

/** Full save from a readable slot (migrated if older), or null. */
export function loadSaveSlot(index: number): SaveGame | null {
  return readSlotSave(index)?.save ?? null;
}

export function writeSaveSlot(
  index: number,
  save: SaveGame,
  now = Date.now(),
): OccupiedSaveSlotView {
  const snapshot = normalizeSave(structuredClone(save));
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      saveSlotStorageKey(index),
      JSON.stringify({
        version: SAVE_VERSION,
        savedAt: now,
        save: snapshot,
      }),
    );
  }
  return {
    index,
    name: saveSlotName(index),
    empty: false,
    night: snapshot.night,
    gold: snapshot.gold,
    savedAt: now,
  };
}

export function deleteSaveSlot(index: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(saveSlotStorageKey(index));
}

/**
 * List all slots. Corrupt entries are deleted when encountered (also the right
 * moment to call this: when the save menu opens); newer-version slots show as
 * empty but stay in storage until overwritten.
 */
export function listSaveSlots(): SaveSlotView[] {
  const slots: SaveSlotView[] = [];
  for (let index = 0; index < SAVE_SLOT_COUNT; index++) {
    slots.push(readSaveSlot(index) ?? emptySlot(index));
  }
  return slots;
}
