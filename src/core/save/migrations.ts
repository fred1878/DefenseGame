import { SAVE_VERSION } from "./saveTypes";

/** A raw (pre-normalize) save object as read from JSON. */
export type RawSave = Record<string, unknown>;

/**
 * Schema migrations, keyed by the version they upgrade FROM. Each step turns a
 * version-N save object into a version-N+1 object; `normalizeSave` then fills
 * defaults and applies the same-version fix-ups. Add a step (and a fixture in
 * `fixtures/`) whenever `SAVE_VERSION` is bumped. Steps must be pure.
 */
export const SAVE_MIGRATIONS: Readonly<
  Record<number, (raw: RawSave) => RawSave>
> = {
  /** v1 → v2: gear added (starts empty), `player.weaponId` removed. */
  1: (raw) => {
    const player =
      typeof raw.player === "object" && raw.player !== null
        ? { ...(raw.player as Record<string, unknown>) }
        : undefined;
    if (!player) return { ...raw };
    delete player.weaponId;
    return { ...raw, player };
  },
};

export type SaveMigrationResult =
  | { ok: true; save: RawSave; migratedFrom: number | null }
  | { ok: false; reason: "unknownVersion" | "newerVersion" | "noMigration" };

/** Upgrade a raw save from `version` to {@link SAVE_VERSION} through the chain. */
export function migrateRawSave(
  version: unknown,
  raw: RawSave,
  migrations: Readonly<
    Record<number, (raw: RawSave) => RawSave>
  > = SAVE_MIGRATIONS,
  target = SAVE_VERSION,
): SaveMigrationResult {
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return { ok: false, reason: "unknownVersion" };
  }
  if (version > target) return { ok: false, reason: "newerVersion" };
  let save = raw;
  for (let v = version; v < target; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, reason: "noMigration" };
    save = step(save);
  }
  return { ok: true, save, migratedFrom: version === target ? null : version };
}
