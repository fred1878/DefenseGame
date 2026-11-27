export const WAVE_PLANNER_COUNT_MIN = 1;
export const WAVE_PLANNER_COUNT_MAX = 99;
export const WAVE_PLANNER_TIME_STEP_MS = 100;
export const WAVE_PLANNER_TIME_MAX_MS = 99_900;

export const WAVE_PLANNER_DEFAULT_AT_MS = 0;
export const WAVE_PLANNER_DEFAULT_INTERVAL_MS = 800;

export function clampWavePlannerCount(value: number): number {
  if (!Number.isFinite(value)) return WAVE_PLANNER_COUNT_MIN;
  return Math.min(
    WAVE_PLANNER_COUNT_MAX,
    Math.max(WAVE_PLANNER_COUNT_MIN, Math.round(value)),
  );
}

export function clampWavePlannerTimeMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const stepped =
    Math.round(value / WAVE_PLANNER_TIME_STEP_MS) * WAVE_PLANNER_TIME_STEP_MS;
  return Math.min(WAVE_PLANNER_TIME_MAX_MS, Math.max(0, stepped));
}
