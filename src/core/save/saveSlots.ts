import { SAVE_VERSION, type SaveGame } from "./saveTypes";
import { saveSlotStorageKey } from "./storageKeys";
import { normalizeSave } from "./GameState";

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

type SaveSlotBlob = {
  version?: unknown;
  savedAt?: unknown;
  save?: unknown;
};

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

function isSaveGameShape(value: unknown): value is SaveGame {
  if (typeof value !== "object" || value === null) return false;
  const save = value as SaveGame;
  return typeof save.night === "number" && typeof save.gold === "number";
}

/**
 * Read one slot. Version mismatches and corrupt JSON are deleted, not migrated.
 * Same-version saves are normalized with the existing intra-version helpers.
 */
export function readSaveSlot(index: number): OccupiedSaveSlotView | null {
  if (typeof localStorage === "undefined") return null;
  const key = saveSlotStorageKey(index);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveSlotBlob;
    if (parsed.version !== SAVE_VERSION || !isSaveGameShape(parsed.save)) {
      localStorage.removeItem(key);
      return null;
    }
    const savedAt =
      typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt)
        ? parsed.savedAt
        : 0;
    const save = normalizeSave(parsed.save);
    return {
      index,
      name: saveSlotName(index),
      empty: false,
      night: save.night,
      gold: save.gold,
      savedAt,
    };
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

/** Full save from a compatible slot, or null if empty / just purged. */
export function loadSaveSlot(index: number): SaveGame | null {
  if (typeof localStorage === "undefined") return null;
  const key = saveSlotStorageKey(index);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveSlotBlob;
    if (parsed.version !== SAVE_VERSION || !isSaveGameShape(parsed.save)) {
      localStorage.removeItem(key);
      return null;
    }
    return normalizeSave(parsed.save);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
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
 * List all slots. Incompatible or corrupt entries are deleted when encountered
 * (also the right moment to call this: when the save menu opens).
 */
export function listSaveSlots(): SaveSlotView[] {
  const slots: SaveSlotView[] = [];
  for (let index = 0; index < SAVE_SLOT_COUNT; index++) {
    slots.push(readSaveSlot(index) ?? emptySlot(index));
  }
  return slots;
}
