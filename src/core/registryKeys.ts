import type Phaser from "phaser";
import type { DataStore } from "./data/DataStore";
import type { SaveGame } from "./save/saveTypes";

/** Phaser game registry key holding the live `SaveGame`. */
export const REGISTRY_SAVE_KEY = "save";
/** Phaser game registry key holding the loaded `DataStore`. */
export const REGISTRY_DATA_STORE_KEY = "dataStore";

type RegistryLike = Pick<Phaser.Data.DataManager, "get" | "set">;

/** Live save (set by Boot before any gameplay scene runs). */
export function getSave(registry: RegistryLike): SaveGame {
  return registry.get(REGISTRY_SAVE_KEY) as SaveGame;
}

/** Live save, or undefined before Boot has stored one. */
export function peekSave(registry: RegistryLike): SaveGame | undefined {
  return registry.get(REGISTRY_SAVE_KEY) as SaveGame | undefined;
}

export function setSave(registry: RegistryLike, save: SaveGame): void {
  registry.set(REGISTRY_SAVE_KEY, save);
}

/** Loaded data (set by Boot before any gameplay scene runs). */
export function getDataStore(registry: RegistryLike): DataStore {
  return registry.get(REGISTRY_DATA_STORE_KEY) as DataStore;
}

/** Loaded data, or undefined before Boot has stored it. */
export function peekDataStore(registry: RegistryLike): DataStore | undefined {
  return registry.get(REGISTRY_DATA_STORE_KEY) as DataStore | undefined;
}

export function setDataStore(registry: RegistryLike, store: DataStore): void {
  registry.set(REGISTRY_DATA_STORE_KEY, store);
}
