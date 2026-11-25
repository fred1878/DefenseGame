export type EndlessRowPickInput = {
  screenX: number;
  screenY: number;
  /** When set, taps in the cap column (screenX >= this) do not map to a row. */
  capColLeft?: number | undefined;
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
 * Screen Y range where a row index is visible in the clipped viewport, with top-edge slop
 * only when the row meets the viewport top (matches the list viewport hit layer).
 */
export function endlessRowVisibleScreenYBand(input: {
  listTop: number;
  listViewportH: number;
  listContentY: number;
  rowIndex: number;
  rowStride: number;
  rowH: number;
  topHitSlopPx?: number;
}): { top: number; bottom: number } | null {
  const topSlop = input.topHitSlopPx ?? 0;
  const bandTop = input.rowIndex * input.rowStride;
  const rowTopScreen = input.listContentY + bandTop;
  const rowBottomScreen = rowTopScreen + input.rowH;
  const viewBottom = input.listTop + input.listViewportH;
  const visibleTop = Math.max(rowTopScreen, input.listTop);
  const visibleBottom = Math.min(rowBottomScreen, viewBottom);
  if (visibleBottom - visibleTop < 1) return null;
  const pickTop =
    visibleTop <= input.listTop ? visibleTop - topSlop : visibleTop;
  return { top: pickTop, bottom: visibleBottom };
}

/**
 * Map a screen point in the endless roster viewport to an enemy id when the name
 * column is tapped. Returns null for the cap column, gaps, or rows outside the
 * clipped viewport band.
 */
export function pickEndlessEnemyRowAtScreen(
  input: EndlessRowPickInput,
): string | null {
  const topSlop = input.topHitSlopPx ?? 0;
  if (input.capColLeft != null && input.screenX >= input.capColLeft) {
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

  const yBand = endlessRowVisibleScreenYBand({
    listTop: input.listTop,
    listViewportH: input.listViewportH,
    listContentY: input.listContentY,
    rowIndex: index,
    rowStride: input.rowStride,
    rowH: input.rowH,
    topHitSlopPx: topSlop,
  });
  if (yBand == null) return null;
  if (input.screenY < yBand.top || input.screenY > yBand.bottom) return null;

  return input.enemyIds[index] ?? null;
}

/**
 * Map a screen point in the endless roster viewport to a row id for hit routing
 * (name + cap columns). Used by the scroll catcher so drags on row chrome pass
 * through to row widgets across the full panel width.
 */
export function pickEndlessRowBandAtScreen(
  input: EndlessRowPickInput & { listLeft: number; rowW: number },
): string | null {
  if (
    input.screenX < input.listLeft ||
    input.screenX > input.listLeft + input.rowW
  ) {
    return null;
  }
  return pickEndlessEnemyRowAtScreen({ ...input, capColLeft: undefined });
}

/** True when any part of the row band intersects the clipped list viewport. */
export function endlessRowCenterOverlapsViewport(input: {
  listTop: number;
  listViewportH: number;
  listContentY: number;
  rowCenterY: number;
  rowH: number;
}): boolean {
  const cy = input.listContentY + input.rowCenterY;
  const half = input.rowH / 2;
  if (cy + half < input.listTop) return false;
  if (cy - half > input.listTop + input.listViewportH) return false;
  return true;
}
