export type ScreenBounds = { x: number; y: number; width: number; height: number };

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