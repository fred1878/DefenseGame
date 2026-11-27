export type ScreenBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Release counts as the same button when the finger ends inside expanded bounds. */
export function pressDragExceedsThreshold(
  startX: number,
  startY: number,
  x: number,
  y: number,
  thresholdPx: number,
): boolean {
  const dx = x - startX;
  const dy = y - startY;
  return dx * dx + dy * dy >= thresholdPx * thresholdPx;
}

export type SpellBarPointerRelease = "none" | "tap" | "longPress";

/**
 * Tap vs long-press vs drag-cancel for spell-bar buttons (decided on pointer up).
 * Auto-cast long-press requires release still on the slot hit area; drag-off is never AUTO.
 */
export function resolveSpellBarPointerRelease(opts: {
  dragExceeded: boolean;
  holdMs: number;
  longPressMs: number;
  releaseOnButton: boolean;
}): SpellBarPointerRelease {
  const { dragExceeded, holdMs, longPressMs, releaseOnButton } = opts;
  if (dragExceeded) return "none";
  if (!releaseOnButton) return "none";
  if (holdMs >= longPressMs) return "longPress";
  return "tap";
}

export function releaseOnSameButton(
  bounds: ScreenBounds,
  releaseX: number,
  releaseY: number,
  slopPx: number,
): boolean {
  return (
    releaseX >= bounds.x - slopPx &&
    releaseX <= bounds.x + bounds.width + slopPx &&
    releaseY >= bounds.y - slopPx &&
    releaseY <= bounds.y + bounds.height + slopPx
  );
}
