import { scaleUiY } from "../config/uiScale";
import type { SafeInsets } from "../ui/screenLayout";

const CLOSE_BUTTON_HALF = scaleUiY(24);
const BOTTOM_MARGIN = scaleUiY(20);

/** Vertical pitch between debug menu toggle rows (tighter than legacy 65px). */
export const DEBUG_MENU_ROW_STEP = scaleUiY(56);

/** Toggle stack is centered on row index 6 (7th row). */
export const DEBUG_MENU_ROW_ANCHOR = 6;

export function debugMenuRowY(stackY: number, rowIndex: number): number {
  return stackY + (rowIndex - DEBUG_MENU_ROW_ANCHOR) * DEBUG_MENU_ROW_STEP;
}

/** Close row offset from the toggle stack center (town). */
export const DEBUG_MENU_CLOSE_OFFSET_TOWN =
  (13 - DEBUG_MENU_ROW_ANCHOR) * DEBUG_MENU_ROW_STEP + scaleUiY(36);
/** Close row offset when "Go to town" is shown above Close (defense). */
export const DEBUG_MENU_CLOSE_OFFSET_DEFENSE =
  (14 - DEBUG_MENU_ROW_ANCHOR) * DEBUG_MENU_ROW_STEP + scaleUiY(36);

export const DEBUG_MENU_GO_TO_TOWN_OFFSET =
  (13 - DEBUG_MENU_ROW_ANCHOR) * DEBUG_MENU_ROW_STEP;

/** Vertical center for debug toggle rows — pulled up on defense so Close stays on-screen. */
export function debugMenuStackCenterY(
  canvasHeight: number,
  safe: SafeInsets,
  fromDefense: boolean,
): number {
  const closeOffset = fromDefense
    ? DEBUG_MENU_CLOSE_OFFSET_DEFENSE
    : DEBUG_MENU_CLOSE_OFFSET_TOWN;
  const maxCloseCenterY =
    canvasHeight - safe.bottom - BOTTOM_MARGIN - CLOSE_BUTTON_HALF;
  const centered = canvasHeight / 2;
  const maxCenterForClose = maxCloseCenterY - closeOffset;
  return Math.min(centered, maxCenterForClose);
}
