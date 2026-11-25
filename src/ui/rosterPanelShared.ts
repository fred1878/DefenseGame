/**
 * Pieces shared by the Endless mode and Wave planner roster panels: the list
 * scrollbar + mask, scrollbar thumb layout, row selection paint and the Start
 * button enabled state.
 */
import type Phaser from "phaser";
import { GAME } from "../config";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { createTouchButton } from "./touchButton";

export type RosterListChrome = {
  scrollTrack: Phaser.GameObjects.Rectangle;
  scrollThumb: Phaser.GameObjects.Rectangle;
  maskGraphics: Phaser.GameObjects.Graphics;
  mask: Phaser.Filters.Mask;
};

/** Scroll track + thumb beside the list, and a Mask filter clipping it to the viewport. */
export function addRosterListChrome(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  listContent: Phaser.GameObjects.Container,
  area: {
    listLeft: number;
    listTop: number;
    rowW: number;
    listViewportH: number;
    maxScroll: number;
  },
): RosterListChrome {
  const { listLeft, listTop, rowW, listViewportH, maxScroll } = area;
  const trackW = scaleUiX(6);
  const trackX = (GAME.width + rowW) / 2 + scaleUiX(4) + trackW / 2;
  const scrollTrack = scene.add
    .rectangle(
      trackX,
      listTop + listViewportH / 2,
      trackW,
      listViewportH,
      0x3f3f46,
      0.85,
    )
    .setOrigin(0.5)
    .setVisible(maxScroll > 0);
  const scrollThumb = scene.add
    .rectangle(trackX, listTop, trackW, scaleUiY(32), 0x71717a, 1)
    .setOrigin(0.5, 0)
    .setVisible(maxScroll > 0);
  root.add([scrollTrack, scrollThumb]);

  const maskGraphics = scene.make.graphics({ x: 0, y: 0 }, false);
  maskGraphics.fillStyle(0xffffff);
  maskGraphics.fillRect(listLeft, listTop, rowW, listViewportH);
  // Phaser 4: GeometryMask is Canvas-only (setMask is ignored under WebGL), so clip
  // the list with the Mask filter, rendered from the same viewport rectangle.
  listContent.enableFilters();
  const mask = listContent.filters!.internal.addMask(maskGraphics);
  return { scrollTrack, scrollThumb, maskGraphics, mask };
}

/** Show/hide the scrollbar and size + place its thumb for `scrollY`. */
export function layoutRosterScrollbar(
  layout: {
    listTop: number;
    listViewportH: number;
    contentHeight: number;
    maxScroll: number;
  },
  scrollY: number,
  scrollTrack: Phaser.GameObjects.Rectangle,
  scrollThumb: Phaser.GameObjects.Rectangle,
): void {
  const show = layout.maxScroll > 0;
  scrollTrack.setVisible(show);
  scrollThumb.setVisible(show);
  if (!show) return;
  const trackH = layout.listViewportH;
  const minThumb = scaleUiY(28);
  const thumbH = Math.max(
    minThumb,
    (layout.listViewportH / layout.contentHeight) * trackH,
  );
  const travel = Math.max(0, trackH - thumbH);
  const thumbY =
    layout.listTop +
    (layout.maxScroll > 0 ? (scrollY / layout.maxScroll) * travel : 0);
  scrollThumb.setDisplaySize(scrollThumb.width, thumbH);
  scrollThumb.y = thumbY;
}

/** Row background + checkbox paint for selected / unselected roster rows. */
export function paintRosterRowSelection(
  row: { bg: Phaser.GameObjects.Rectangle; check: Phaser.GameObjects.Text },
  on: boolean,
): void {
  row.bg.setFillStyle(on ? 0x1e3a5f : 0x3f3f46);
  row.bg.setStrokeStyle(2, on ? 0x60a5fa : 0x71717a);
  row.check.setText(on ? "☑" : "☐");
  row.check.setColor(on ? "#93c5fd" : "#a1a1aa");
}

/** Dim and disable the Start button when nothing is selected. */
export function setRosterStartEnabled(
  startBtn: ReturnType<typeof createTouchButton> | null,
  enabled: boolean,
): void {
  const btn = startBtn?.container;
  if (!btn) return;
  btn.setAlpha(enabled ? 1 : 0.45);
  if (enabled) btn.setInteractive();
  else btn.disableInteractive();
}
