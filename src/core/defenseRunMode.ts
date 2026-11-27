import type { WaveGroup } from "./data/DataStore";
import {
  clampEndlessConcurrent,
  ENDLESS_CONCURRENT_MIN,
} from "./endlessLimits";
import {
  clampWavePlannerCount,
  clampWavePlannerTimeMs,
  WAVE_PLANNER_DEFAULT_AT_MS,
  WAVE_PLANNER_DEFAULT_INTERVAL_MS,
} from "./wavePlannerTiming";

export type EndlessRunSelection = {
  enemyId: string;
  /** Target living count for this type (1–99), set in the endless selection panel. */
  concurrentCap: number;
};

export type WavePlannerGroupSelection = WaveGroup;

export type DefenseRunMode =
  | { kind: "night" }
  | {
      kind: "endless";
      selections: EndlessRunSelection[];
      /** When true, player HP does not drop during endless defense. */
      infiniteHp?: boolean;
    }
  | {
      kind: "wavePlanner";
      groups: WavePlannerGroupSelection[];
    };

export const DEFENSE_RUN_MODE_KEY = "defenseRunMode";

type LegacyEndlessRunMode = { kind: "endless"; enemyId: string };

function isWavePlannerPayload(
  raw: unknown,
): raw is { kind: "wavePlanner"; groups: WavePlannerGroupSelection[] } {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as { kind?: string; groups?: unknown };
  return (
    r.kind === "wavePlanner" &&
    Array.isArray(r.groups) &&
    r.groups.length > 0 &&
    r.groups.every(
      (g) =>
        typeof g === "object" &&
        g !== null &&
        typeof (g as WavePlannerGroupSelection).enemyId === "string" &&
        typeof (g as WavePlannerGroupSelection).count === "number",
    )
  );
}

function isEndlessSelections(raw: unknown): raw is {
  kind: "endless";
  selections: EndlessRunSelection[];
  infiniteHp?: boolean;
} {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as {
    kind?: string;
    selections?: unknown;
    infiniteHp?: unknown;
  };
  return (
    r.kind === "endless" &&
    Array.isArray(r.selections) &&
    r.selections.length > 0 &&
    r.selections.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as EndlessRunSelection).enemyId === "string",
    ) &&
    (r.infiniteHp === undefined || r.infiniteHp === true)
  );
}

/** Clamp panel caps only — spawner must not substitute JSON/code defaults. */
export function resolveEndlessRunSelections(
  selections: EndlessRunSelection[],
): EndlessRunSelection[] {
  return selections.map((s) => ({
    enemyId: s.enemyId,
    concurrentCap: clampEndlessConcurrent(
      s.concurrentCap > 0 ? s.concurrentCap : ENDLESS_CONCURRENT_MIN,
    ),
  }));
}

export function resolveWavePlannerGroups(
  groups: WavePlannerGroupSelection[],
): WavePlannerGroupSelection[] {
  return groups.map((g) => ({
    enemyId: g.enemyId,
    count: clampWavePlannerCount(g.count),
    atMs: clampWavePlannerTimeMs(
      Number.isFinite(g.atMs) ? g.atMs : WAVE_PLANNER_DEFAULT_AT_MS,
    ),
    intervalMs: clampWavePlannerTimeMs(
      Number.isFinite(g.intervalMs)
        ? g.intervalMs
        : WAVE_PLANNER_DEFAULT_INTERVAL_MS,
    ),
  }));
}

export function readDefenseRunMode(
  registry: Phaser.Data.DataManager,
): DefenseRunMode {
  const raw = registry.get(DEFENSE_RUN_MODE_KEY) as
    | DefenseRunMode
    | LegacyEndlessRunMode
    | undefined;
  if (isWavePlannerPayload(raw)) {
    return {
      kind: "wavePlanner",
      groups: resolveWavePlannerGroups(raw.groups),
    };
  }
  if (isEndlessSelections(raw)) {
    return raw.infiniteHp
      ? { kind: "endless", selections: raw.selections, infiniteHp: true }
      : { kind: "endless", selections: raw.selections };
  }
  const legacy = raw as LegacyEndlessRunMode | undefined;
  if (legacy?.kind === "endless" && legacy.enemyId) {
    return {
      kind: "endless",
      selections: [{ enemyId: legacy.enemyId, concurrentCap: 0 }],
    };
  }
  return { kind: "night" };
}

export function setNightDefenseRun(registry: Phaser.Data.DataManager): void {
  registry.set(DEFENSE_RUN_MODE_KEY, {
    kind: "night",
  } satisfies DefenseRunMode);
}

export function setEndlessDefenseRun(
  registry: Phaser.Data.DataManager,
  selections: EndlessRunSelection[],
  infiniteHp = false,
): void {
  const payload: DefenseRunMode = infiniteHp
    ? { kind: "endless", selections, infiniteHp: true }
    : { kind: "endless", selections };
  registry.set(DEFENSE_RUN_MODE_KEY, payload);
}

export function setWavePlannerDefenseRun(
  registry: Phaser.Data.DataManager,
  groups: WavePlannerGroupSelection[],
): void {
  registry.set(DEFENSE_RUN_MODE_KEY, {
    kind: "wavePlanner",
    groups: resolveWavePlannerGroups(groups),
  } satisfies DefenseRunMode);
}

export function clearDefenseRunMode(registry: Phaser.Data.DataManager): void {
  registry.remove(DEFENSE_RUN_MODE_KEY);
}
