import type { SafeInsets } from "../ui/layout/screenLayout";

/**
 * Debug menu sheet layout in logical (540×1200) px. Every row is laid out top-down
 * inside the sheet, so the title, first row (Hitboxes) and footer buttons always sit
 * on screen in town and defense (the old scaled stack pushed them off the top).
 */
export type DebugMenuItem =
  | { kind: "section"; label: string }
  | { kind: "row"; id: string };

export type DebugMenuLayout = {
  sheet: { x: number; y: number; w: number; h: number };
  titleY: number;
  /** Centre y per section label / row id. */
  y: Record<string, number>;
  footerY: number;
  rowH: number;
};

export const DEBUG_MENU_ROW_H = 50;
const SECTION_H = 34;
const TITLE_H = 70;
const FOOTER_H = 84;
const SHEET_MARGIN = 6;
const TOP_GAP = 20;
const BOTTOM_GAP = 8;

export function layoutDebugMenu(
  canvasW: number,
  canvasH: number,
  safe: SafeInsets,
  items: readonly DebugMenuItem[],
): DebugMenuLayout {
  const top = safe.top + TOP_GAP;
  const bottom = canvasH - safe.bottom - BOTTOM_GAP;
  const sheet = {
    x: SHEET_MARGIN,
    y: top,
    w: canvasW - 2 * SHEET_MARGIN,
    h: bottom - top,
  };
  const content = items.reduce(
    (n, it) => n + (it.kind === "section" ? SECTION_H : DEBUG_MENU_ROW_H),
    0,
  );
  // Squeeze rows on short screens so the footer never leaves the sheet.
  const room = sheet.h - TITLE_H - FOOTER_H;
  const k = content > room ? room / content : 1;
  const y: Record<string, number> = {};
  let cursor = sheet.y + TITLE_H;
  items.forEach((it, i) => {
    const h = (it.kind === "section" ? SECTION_H : DEBUG_MENU_ROW_H) * k;
    const key = it.kind === "section" ? `section:${i}` : it.id;
    y[key] = cursor + (it.kind === "section" ? h * 0.62 : h / 2);
    cursor += h;
  });
  return {
    sheet,
    titleY: sheet.y + 34,
    y,
    footerY: sheet.y + sheet.h - FOOTER_H / 2 - 4,
    rowH: DEBUG_MENU_ROW_H * k,
  };
}
