/**
 * Screen layout helpers (540×1200 design canvas), barrel.
 * Parts: `screenLayoutCore.ts` (safe insets, HUD band, viewport/camera),
 * `defenseHudLayout.ts` (Defense HUD / combat chrome / spell bar),
 * `townHudLayout.ts` (Town title, header buttons, building grid).
 */
export {
  bindViewportToScale,
  cameraWorldPoint,
  hudBandHeight,
  readSafeInsets,
  type SafeInsets,
  type ScreenRect,
} from "./screenLayoutCore";
export * from "../hud/defenseHudLayout";
export * from "../hud/fpsHudLayout";
export * from "../hud/townHudLayout";
