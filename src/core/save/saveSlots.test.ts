import { afterEach, describe, expect, it, vi } from "vitest";
import { createNewSave, normalizeSave } from "./GameState";
import { SAVE_VERSION } from "./saveTypes";
import saveV1 from "./fixtures/save-v1.json";
import { saveSlotStorageKey } from "./storageKeys";
import {
  SAVE_SLOT_COUNT,
  deleteSaveSlot,
  formatSaveSlotMeta,
  formatSaveSlotTimestamp,
  listSaveSlots,
  loadSaveSlot,
  readSaveSlot,
  saveSlotName,
  writeSaveSlot,
} from "./saveSlots";

function stubStorage(): Map<string, string> {
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => {
      items.set(k, v);
    },
    removeItem: (k: string) => {
      items.delete(k);
    },
  });
  return items;
}

describe("saveSlots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names slots 1-based and lists five empty slots", () => {
    stubStorage();
    expect(saveSlotName(0)).toBe("Slot 1");
    expect(saveSlotName(4)).toBe("Slot 5");
    const slots = listSaveSlots();
    expect(slots).toHaveLength(SAVE_SLOT_COUNT);
    expect(slots.every((s) => s.empty)).toBe(true);
  });

  it("saves, loads and deletes a slot", () => {
    stubStorage();
    const save = createNewSave();
    save.night = 4;
    save.gold = 85;
    const written = writeSaveSlot(2, save, 1_700_000_000_000);
    expect(written.empty).toBe(false);
    expect(written.night).toBe(4);
    expect(written.gold).toBe(85);
    expect(written.savedAt).toBe(1_700_000_000_000);

    const listed = listSaveSlots();
    expect(listed[2]).toEqual(written);
    expect(listed.filter((s) => !s.empty)).toHaveLength(1);

    const loaded = loadSaveSlot(2);
    expect(loaded?.night).toBe(4);
    expect(loaded?.gold).toBe(85);
    expect(loaded?.player.hp).toBe(save.player.hp);

    deleteSaveSlot(2);
    expect(loadSaveSlot(2)).toBeNull();
    expect(listSaveSlots()[2]?.empty).toBe(true);
  });

  it("keeps a slot written by a newer build but reports it unreadable", () => {
    const items = stubStorage();
    const save = createNewSave();
    items.set(
      saveSlotStorageKey(0),
      JSON.stringify({ version: SAVE_VERSION + 1, savedAt: 10, save }),
    );
    expect(readSaveSlot(0)).toBeNull();
    expect(loadSaveSlot(0)).toBeNull();
    expect(listSaveSlots()[0]?.empty).toBe(true);
    expect(items.has(saveSlotStorageKey(0))).toBe(true);
  });

  it("migrates a v1 slot instead of deleting it", () => {
    const items = stubStorage();
    items.set(saveSlotStorageKey(1), JSON.stringify(saveV1));
    const view = readSaveSlot(1);
    expect(view).toMatchObject({ night: 5, gold: 120, savedAt: 1764000000000 });
    const loaded = loadSaveSlot(1);
    expect(loaded?.night).toBe(5);
    expect(loaded?.gear.items).toEqual([]);
    expect(loaded?.player).not.toHaveProperty("weaponId");
    expect(items.has(saveSlotStorageKey(1))).toBe(true);
  });

  it("deletes corrupt JSON and blobs missing a save", () => {
    const items = stubStorage();
    items.set(saveSlotStorageKey(0), "{not-json");
    items.set(
      saveSlotStorageKey(1),
      JSON.stringify({ version: SAVE_VERSION, savedAt: 1 }),
    );
    items.set(
      saveSlotStorageKey(2),
      JSON.stringify({ version: SAVE_VERSION, savedAt: 1, save: "nope" }),
    );
    const slots = listSaveSlots();
    expect(slots[0]?.empty).toBe(true);
    expect(slots[1]?.empty).toBe(true);
    expect(slots[2]?.empty).toBe(true);
    expect(items.has(saveSlotStorageKey(0))).toBe(false);
    expect(items.has(saveSlotStorageKey(1))).toBe(false);
    expect(items.has(saveSlotStorageKey(2))).toBe(false);
  });

  it("formats metadata and timestamps in local time", () => {
    expect(formatSaveSlotTimestamp(0)).toBe("Unknown time");
    const ms = new Date(2026, 10, 25, 23, 15).getTime();
    expect(formatSaveSlotTimestamp(ms)).toBe("25 Nov 2026, 23:15");
    expect(
      formatSaveSlotMeta({
        index: 0,
        name: "Slot 1",
        empty: true,
      }),
    ).toBe("Empty");
    expect(
      formatSaveSlotMeta({
        index: 0,
        name: "Slot 1",
        empty: false,
        night: 3,
        gold: 120,
        savedAt: ms,
      }),
    ).toBe("Night 3 · 120g\n25 Nov 2026, 23:15");
  });

  it("normalizes a same-version slot with legacy fields instead of deleting it", () => {
    const items = stubStorage();
    const base = createNewSave();
    const legacy = {
      ...base,
      night: 6,
      gold: 40,
      player: { ...base.player, moveSpeed: 73 },
    };
    items.set(
      saveSlotStorageKey(3),
      JSON.stringify({
        version: SAVE_VERSION,
        savedAt: 99,
        save: legacy,
      }),
    );
    const loaded = loadSaveSlot(3);
    expect(loaded?.night).toBe(6);
    expect(loaded?.player).not.toHaveProperty("moveSpeed");
    expect(normalizeSave(legacy).night).toBe(6);
    expect(items.has(saveSlotStorageKey(3))).toBe(true);
  });

  it("no-ops when localStorage is missing and defaults a bad savedAt", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readSaveSlot(0)).toBeNull();
    expect(loadSaveSlot(0)).toBeNull();
    expect(() => deleteSaveSlot(0)).not.toThrow();
    const written = writeSaveSlot(0, createNewSave(), 5);
    expect(written.savedAt).toBe(5);
    vi.unstubAllGlobals();

    const items = stubStorage();
    items.set(
      saveSlotStorageKey(0),
      JSON.stringify({
        version: SAVE_VERSION,
        savedAt: "later",
        save: createNewSave(),
      }),
    );
    expect(readSaveSlot(0)?.savedAt).toBe(0);
  });
});
