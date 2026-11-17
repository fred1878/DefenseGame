import { clampEndlessConcurrent } from "../systems/endlessSpawnScheduler";

export type EndlessRunSelection = {
  enemyId: string;
  /** Target living count for this type (3–10). Use 0 to resolve from enemy data at defense start. */
  concurrentCap: number;
};

export type DefenseRunMode =
  | { kind: "night" }
  | { kind: "endless"; selections: EndlessRunSelection[] };

export const DEFENSE_RUN_MODE_KEY = "defenseRunMode";

type LegacyEndlessRunMode = { kind: "endless"; enemyId: string };

function isEndlessSelections(
  raw: unknown,
): raw is { kind: "endless"; selections: EndlessRunSelection[] } {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as { kind?: string; selections?: unknown };
  return (
    r.kind === "endless" &&
    Array.isArray(r.selections) &&
    r.selections.length > 0 &&
    r.selections.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as EndlessRunSelection).enemyId === "string",
    )
  );
}

export function resolveEndlessRunSelections(
  selections: EndlessRunSelection[],
  defaultCapForEnemy: (enemyId: string) => number,
): EndlessRunSelection[] {
  return selections.map((s) => ({
    enemyId: s.enemyId,
    concurrentCap:
      s.concurrentCap > 0
        ? clampEndlessConcurrent(s.concurrentCap)
        : defaultCapForEnemy(s.enemyId),
  }));
}

export function readDefenseRunMode(
  registry: Phaser.Data.DataManager,
): DefenseRunMode {
  const raw = registry.get(DEFENSE_RUN_MODE_KEY) as
    | DefenseRunMode
    | LegacyEndlessRunMode
    | undefined;
  if (isEndlessSelections(raw)) {
    return raw;
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
  registry.set(DEFENSE_RUN_MODE_KEY, { kind: "night" } satisfies DefenseRunMode);
}

export function setEndlessDefenseRun(
  registry: Phaser.Data.DataManager,
  selections: EndlessRunSelection[],
): void {
  registry.set(DEFENSE_RUN_MODE_KEY, {
    kind: "endless",
    selections,
  } satisfies DefenseRunMode);
}

export function clearDefenseRunMode(registry: Phaser.Data.DataManager): void {
  registry.remove(DEFENSE_RUN_MODE_KEY);
}