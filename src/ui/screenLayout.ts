/**
 * Screen layout helpers (540×1200 design canvas), barrel.
 * Parts: `screenLayoutCore.ts` (safe insets, HUD band, viewport/camera),
 * `defenseHudLayout.ts` (Defense HUD / combat chrome / spell bar),
 * `townHudLayout.ts` (Town title, header buttons).
 */
export {
  bindViewportToScale,
  cameraWorldPoint,
  hudBandHeight,
  readSafeInsets,
  type SafeInsets,
  type ScreenRect,
} from "./screenLayoutCore";
export * from "./defenseHudLayout";
export * from "./fpsHudLayout";
export * from "./townHudLayout";
