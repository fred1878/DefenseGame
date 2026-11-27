/** Allowed living enemies per type in endless training (inclusive). */
export const ENDLESS_CONCURRENT_MIN = 1;
export const ENDLESS_CONCURRENT_MAX = 99;

export function clampEndlessConcurrent(value: number): number {
  if (!Number.isFinite(value)) return ENDLESS_CONCURRENT_MIN;
  return Math.min(
    ENDLESS_CONCURRENT_MAX,
    Math.max(ENDLESS_CONCURRENT_MIN, Math.round(value)),
  );
}
