import { describe, expect, it } from "vitest";
import type { DataStore } from "./data/DataStore";
import {
  getDataStore,
  getSave,
  peekDataStore,
  peekSave,
  REGISTRY_DATA_STORE_KEY,
  REGISTRY_SAVE_KEY,
  setDataStore,
  setSave,
} from "./registryKeys";
import { createNewSave } from "./save/GameState";

function fakeRegistry() {
  const values = new Map<string, unknown>();
  return {
    values,
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
}

describe("registryKeys", () => {
  it("round-trips the save under the shared key", () => {
    const registry = fakeRegistry();
    expect(peekSave(registry as never)).toBeUndefined();
    const save = createNewSave();
    setSave(registry as never, save);
    expect(registry.values.get(REGISTRY_SAVE_KEY)).toBe(save);
    expect(getSave(registry as never)).toBe(save);
    expect(peekSave(registry as never)).toBe(save);
  });

  it("round-trips the data store under the shared key", () => {
    const registry = fakeRegistry();
    expect(peekDataStore(registry as never)).toBeUndefined();
    const store = { marker: true } as unknown as DataStore;
    setDataStore(registry as never, store);
    expect(registry.values.get(REGISTRY_DATA_STORE_KEY)).toBe(store);
    expect(getDataStore(registry as never)).toBe(store);
    expect(peekDataStore(registry as never)).toBe(store);
  });
});
