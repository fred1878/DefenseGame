import { afterEach, describe, expect, it, vi } from "vitest";
import saveV1 from "./fixtures/save-v1.json";
import saveV2 from "./fixtures/save-v2.json";
import { createNewSave } from "./GameState";
import {
  isSaveShape,
  keepUnreadableSave,
  loadSave,
  parseStoredSave,
  persistSave,
} from "./saveRepository";
import { SAVE_VERSION } from "./saveTypes";
import { saveStorageKey } from "./storageKeys";

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

describe("parseStoredSave", () => {
  it("reads a current-version fixture", () => {
    const r = parseStoredSave(JSON.stringify(saveV2));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.night).toBe(7);
    expect(r.save.gold).toBe(340);
    expect(r.save.consumables).toEqual({ healing_potion: 2 });
    expect(r.save.talents.earned).toBe(6);
    expect(r.savedAt).toBe(1764100000000);
  });

  it("migrates the v1 fixture to a complete current save", () => {
    const r = parseStoredSave(JSON.stringify(saveV1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const fresh = createNewSave();
    expect(r.save.night).toBe(5);
    expect(r.save.gold).toBe(120);
    expect(r.save.buildings.wall).toBe(1);
    expect(r.save.townWallHp).toBe(130);
    expect(r.save.player.hp).toBe(80);
    expect(r.save.player).not.toHaveProperty("weaponId");
    expect(r.save.gear).toEqual(fresh.gear);
    expect(r.save.consumables).toEqual({});
    // legacy spell id remapped by the same-version fix-ups
    expect(r.save.spellBar.slots[2]).toBe("fire_nova");
    expect(r.save.flags).toEqual(["met_blacksmith"]);
  });

  it("classifies unreadable blobs", () => {
    expect(parseStoredSave("{nope")).toEqual({ ok: false, reason: "corrupt" });
    expect(parseStoredSave("42")).toEqual({ ok: false, reason: "corrupt" });
    expect(parseStoredSave(JSON.stringify({ version: 2 }))).toEqual({
      ok: false,
      reason: "invalidShape",
    });
    expect(
      parseStoredSave(
        JSON.stringify({ version: SAVE_VERSION + 1, save: saveV2.save }),
      ),
    ).toEqual({ ok: false, reason: "newerVersion" });
    expect(parseStoredSave(JSON.stringify({ save: saveV2.save }))).toEqual({
      ok: false,
      reason: "unknownVersion",
    });
  });

  it("only keeps newer-version blobs", () => {
    expect(keepUnreadableSave("newerVersion")).toBe(true);
    expect(keepUnreadableSave("corrupt")).toBe(false);
    expect(keepUnreadableSave("invalidShape")).toBe(false);
  });

  it("isSaveShape needs night and gold numbers", () => {
    expect(isSaveShape({ night: 1, gold: 0 })).toBe(true);
    expect(isSaveShape({ night: 1 })).toBe(false);
    expect(isSaveShape(null)).toBe(false);
  });
});

describe("autosave", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("migrates a v1 autosave instead of starting over", () => {
    const items = stubStorage();
    items.set(saveStorageKey(), JSON.stringify(saveV1));
    const save = loadSave();
    expect(save.night).toBe(5);
    expect(save.gold).toBe(120);
  });

  it("leaves a newer-version autosave in storage and starts fresh", () => {
    const items = stubStorage();
    const blob = JSON.stringify({
      version: SAVE_VERSION + 1,
      save: saveV2.save,
    });
    items.set(saveStorageKey(), blob);
    expect(loadSave().night).toBe(1);
    expect(items.get(saveStorageKey())).toBe(blob);
  });

  it("round-trips through persistSave", () => {
    const items = stubStorage();
    const save = createNewSave();
    save.gold = 77;
    persistSave(save);
    expect(JSON.parse(items.get(saveStorageKey()) ?? "{}").version).toBe(
      SAVE_VERSION,
    );
    expect(loadSave().gold).toBe(77);
  });
});
