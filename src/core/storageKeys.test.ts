import { afterEach, describe, expect, it } from "vitest";
import {
  E2E_SAVE_STORAGE_KEY,
  saveSlotStorageKey,
  saveStorageKey,
  setE2EStorageIsolation,
} from "./storageKeys";

describe("storageKeys", () => {
  afterEach(() => {
    setE2EStorageIsolation(() => false);
  });

  it("uses production keys until an E2E check is installed", () => {
    expect(saveStorageKey()).toBe("defensegame_save_v1");
    expect(saveSlotStorageKey(2)).toBe("defensegame_save_slot_2");
  });

  it("isolates E2E saves when the installed check is on", () => {
    let on = true;
    setE2EStorageIsolation(() => on);
    expect(saveStorageKey()).toBe(E2E_SAVE_STORAGE_KEY);
    expect(saveSlotStorageKey(0)).toBe("defensegame-e2e-save-slot-0");
    on = false;
    expect(saveStorageKey()).toBe("defensegame_save_v1");
  });
});
