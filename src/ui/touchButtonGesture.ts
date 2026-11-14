export type ScreenBounds = { x: number; y: number; width: number; height: number };

/** Release counts as the same button when the finger ends inside expanded bounds. */
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