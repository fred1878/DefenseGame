export type EndlessRowPickInput = {
  screenX: number;
  screenY: number;
  capColLeft: number;
  listTop: number;
  listViewportH: number;
  listContentY: number;
  rowStride: number;
  rowH: number;
  enemyIds: readonly string[];
  /** Extra pixels above listTop that still count as in the viewport (hit slop). */
  topHitSlopPx?: number;
};

/**
 * Map a screen point in the endless roster viewport to an enemy id when the name
 * column is tapped. Returns null for the cap column, gaps, or rows outside the
 * clipped viewport band.
 */
export function pickEndlessEnemyRowAtScreen(
  input: EndlessRowPickInput,
): string | null {
  const topSlop = input.topHitSlopPx ?? 0;
  if (input.screenX >= input.capColLeft) {
    return null;
  }
  if (
    input.screenY < input.listTop - topSlop ||
    input.screenY > input.listTop + input.listViewportH
  ) {
    return null;
  }
  let contentY = input.screenY - input.listContentY;
  if (contentY < 0) {
    if (contentY < -topSlop) return null;
    contentY = 0;
  }
  const index = Math.floor(contentY / input.rowStride);
  if (index < 0 || index >= input.enemyIds.length) return null;
  const bandTop = index * input.rowStride;
  const bandBottom = bandTop + input.rowH;
  if (contentY < bandTop || contentY > bandBottom) return null;

  const rowTopScreen = input.listContentY + bandTop;
  const rowBottomScreen = rowTopScreen + input.rowH;
  const visibleTop = Math.max(rowTopScreen, input.listTop);
  const visibleBottom = Math.min(
    rowBottomScreen,
    input.listTop + input.listViewportH,
  );
  if (visibleBottom - visibleTop < 1) return null;
  const pickMinY = Math.min(visibleTop, input.listTop) - topSlop;
  if (input.screenY < pickMinY || input.screenY > visibleBottom) return null;

  return input.enemyIds[index] ?? null;
}