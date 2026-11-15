/**
 * Portrait design canvas (9:20). Matches 1080×2400 at 2× FIT (540×2, 1200×2) for crisp integer upscale.
 * UI constants from the 390×844 pass are scaled via `scaleUiX` / `scaleUiY` in `src/core/displayScale.ts`.
 */
export const GAME = {
  width: 540,
  height: 1200,
  /** Max internal Text resolution multiplier on high-DPI browsers. */
  renderResolutionCap: 3,
} as const;