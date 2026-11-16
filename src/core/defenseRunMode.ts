export type DefenseRunMode =
  | { kind: "night" }
  | { kind: "endless"; enemyId: string };

export const DEFENSE_RUN_MODE_KEY = "defenseRunMode";

export function readDefenseRunMode(
  registry: Phaser.Data.DataManager,
): DefenseRunMode {
  const raw = registry.get(DEFENSE_RUN_MODE_KEY) as DefenseRunMode | undefined;
  if (raw?.kind === "endless" && raw.enemyId) return raw;
  return { kind: "night" };
}

export function setNightDefenseRun(registry: Phaser.Data.DataManager): void {
  registry.set(DEFENSE_RUN_MODE_KEY, { kind: "night" } satisfies DefenseRunMode);
}

export function setEndlessDefenseRun(
  registry: Phaser.Data.DataManager,
  enemyId: string,
): void {
  registry.set(DEFENSE_RUN_MODE_KEY, {
    kind: "endless",
    enemyId,
  } satisfies DefenseRunMode);
}

export function clearDefenseRunMode(registry: Phaser.Data.DataManager): void {
  registry.remove(DEFENSE_RUN_MODE_KEY);
}