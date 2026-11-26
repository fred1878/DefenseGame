import { scaleUiY } from "../core/displayScale";
import type { SafeInsets } from "../ui/screenLayout";

const CLOSE_BUTTON_HALF = scaleUiY(24);
const BOTTOM_MARGIN = scaleUiY(20);

/** Close row offset from the toggle stack center (town). */
export const DEBUG_MENU_CLOSE_OFFSET_TOWN = scaleUiY(368);
/** Close row offset when "Go to town" is shown above Close (defense). */
export const DEBUG_MENU_CLOSE_OFFSET_DEFENSE = scaleUiY(433);

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
