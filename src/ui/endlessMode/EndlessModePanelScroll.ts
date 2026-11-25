import Phaser from "phaser";
import { scaleUiY } from "../../core/displayScale";
import { hitAreaLocalPointToScreen } from "../touchButton";
import {
  endlessRowCenterOverlapsViewport,
  endlessRowVisibleScreenYBand,
  pickEndlessEnemyRowAtScreen,
} from "../endlessModePanelPick";
import { layoutRosterScrollbar } from "../rosterPanelShared";
import {
  LIST_VIEWPORT_TOP_HIT_SLOP_PX,
  type EndlessListLayout,
  type EnemyRow,
} from "./EndlessModePanelBuild";

const TAP_DRAG_THRESHOLD_PX = 10;

/** List widgets the scroll controller drives (set once by `attach`). */
export type EndlessScrollView = {
  listContent: Phaser.GameObjects.Container;
  scrollTrack: Phaser.GameObjects.Rectangle;
  scrollThumb: Phaser.GameObjects.Rectangle;
  layout: EndlessListLayout;
  rows: EnemyRow[];
};

type DragSource = "viewport" | "row" | "cap";

/**
 * Roster list scrolling: drag-to-scroll (tap vs drag), wheel, scrollbar, and the
 * row / cap hit tests that keep taps inside the masked viewport.
 */
export class EndlessModePanelScroll {
  private view!: EndlessScrollView;
  private scrollYValue = 0;
  private dragPointerId: number | null = null;
  private dragStartScroll = 0;
  private dragStartPointerY = 0;
  private dragAccum = 0;
  private dragListening = false;
  private dragSource: DragSource | null = null;
  private dragRowEnemyId: string | null = null;
  private readonly onWheel = (
    _pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _dx: number,
    deltaY: number,
  ): void => {
    if (deltaY === 0) return;
    this.applyScroll(this.scrollYValue + deltaY * 0.35);
  };

  constructor(
    private readonly scene: Phaser.Scene,
    /** Called when a tap (not a drag) lands on a roster row name. */
    private readonly onTapRow: (enemyId: string) => void,
  ) {}

  attach(view: EndlessScrollView): void {
    this.view = view;
  }

  get scrollY(): number {
    return this.scrollYValue;
  }

  bindWheel(): void {
    this.scene.input.on("wheel", this.onWheel);
  }

  destroy(): void {
    this.detachSceneDragListeners();
    this.scene.input.off("wheel", this.onWheel);
  }

  /** Viewport scroll catcher: full roster band (row widgets sit above for taps/drags). */
  listViewportHitForScroll(screenX: number, screenY: number): boolean {
    const { listLeft, rowW, listTop, listViewportH } = this.view.layout;
    const topSlop = scaleUiY(LIST_VIEWPORT_TOP_HIT_SLOP_PX);
    if (screenX < listLeft || screenX > listLeft + rowW) return false;
    if (screenY < listTop - topSlop || screenY > listTop + listViewportH) {
      return false;
    }
    return true;
  }

  listViewportPointerToScreen(
    viewport: Phaser.GameObjects.Rectangle,
    localX: number,
    localY: number,
  ): { screenX: number; screenY: number } | null {
    const pt = hitAreaLocalPointToScreen(viewport, localX, localY);
    return pt ? { screenX: pt.x, screenY: pt.y } : null;
  }

  private readonly onSceneDragMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.dragPointerId !== pointer.id) return;
    this.continueDrag(pointer);
  };

  private readonly onSceneDragEnd = (pointer: Phaser.Input.Pointer): void => {
    if (this.dragPointerId !== pointer.id) return;
    const source = this.dragSource;
    const rowEnemyId = this.dragRowEnemyId;
    const tapped = this.endDrag();
    if (!tapped) return;
    if (source === "row" && rowEnemyId) {
      this.onTapRow(rowEnemyId);
      return;
    }
    if (source === "viewport") {
      const enemyId = this.pickVisibleRowAtScreen(pointer.x, pointer.y);
      if (enemyId) this.onTapRow(enemyId);
    }
  };

  private attachSceneDragListeners(): void {
    if (this.dragListening) return;
    this.dragListening = true;
    this.scene.input.on("pointermove", this.onSceneDragMove);
    this.scene.input.on("pointerup", this.onSceneDragEnd);
    this.scene.input.on("pointerupoutside", this.onSceneDragEnd);
  }

  private detachSceneDragListeners(): void {
    if (!this.dragListening) return;
    this.dragListening = false;
    this.scene.input.off("pointermove", this.onSceneDragMove);
    this.scene.input.off("pointerup", this.onSceneDragEnd);
    this.scene.input.off("pointerupoutside", this.onSceneDragEnd);
  }

  beginDrag(
    pointer: Phaser.Input.Pointer,
    source: DragSource,
    enemyId?: string,
  ): void {
    this.dragPointerId = pointer.id;
    this.dragSource = source;
    this.dragRowEnemyId = enemyId ?? null;
    this.dragStartScroll = this.scrollYValue;
    this.dragStartPointerY = pointer.y;
    this.dragAccum = 0;
    this.attachSceneDragListeners();
  }

  private continueDrag(pointer: Phaser.Input.Pointer): void {
    const dy = pointer.y - this.dragStartPointerY;
    this.dragAccum = Math.max(this.dragAccum, Math.abs(dy));
    this.applyScroll(this.dragStartScroll - dy);
  }

  private endDrag(): boolean {
    const tapped = this.dragAccum < TAP_DRAG_THRESHOLD_PX;
    this.dragPointerId = null;
    this.dragAccum = 0;
    this.dragSource = null;
    this.dragRowEnemyId = null;
    this.detachSceneDragListeners();
    return tapped;
  }

  private rowViewportState(row: EnemyRow) {
    const { layout, listContent } = this.view;
    return {
      listTop: layout.listTop,
      listViewportH: layout.listViewportH,
      listContentY: listContent.y,
      rowCenterY: row.bg.y,
      rowH: layout.rowH,
    };
  }

  rowNameHitTest(
    row: EnemyRow,
  ): (
    hitArea: Phaser.Geom.Rectangle,
    x: number,
    y: number,
    gameObject: Phaser.GameObjects.GameObject,
  ) => boolean {
    return (hitArea, x, y, gameObject) => {
      if (!Phaser.Geom.Rectangle.Contains(hitArea, x, y)) return false;
      const pt = hitAreaLocalPointToScreen(gameObject, x, y);
      if (!pt) return false;
      const { layout, listContent, rows } = this.view;
      if (pt.x >= layout.capColLeft) return false;
      const rowIndex = rows.indexOf(row);
      if (rowIndex < 0) return false;
      const bandTop = rowIndex * layout.rowStride;
      const bandBottom = bandTop + layout.rowH;
      const contentY = pt.y - listContent.y;
      if (contentY < bandTop || contentY > bandBottom) return false;
      const topSlop = scaleUiY(LIST_VIEWPORT_TOP_HIT_SLOP_PX);
      const yBand = endlessRowVisibleScreenYBand({
        listTop: layout.listTop,
        listViewportH: layout.listViewportH,
        listContentY: listContent.y,
        rowIndex,
        rowStride: layout.rowStride,
        rowH: layout.rowH,
        topHitSlopPx: topSlop,
      });
      if (yBand == null) return false;
      return pt.y >= yBand.top && pt.y <= yBand.bottom;
    };
  }

  rowCapHitTest(
    row: EnemyRow,
  ): (hitArea: Phaser.Geom.Rectangle, x: number, y: number) => boolean {
    return (hitArea, x, y) => {
      if (!Phaser.Geom.Rectangle.Contains(hitArea, x, y)) return false;
      return endlessRowCenterOverlapsViewport(this.rowViewportState(row));
    };
  }

  pickVisibleRowAtScreen(screenX: number, screenY: number): string | null {
    const { layout, listContent, rows } = this.view;
    return pickEndlessEnemyRowAtScreen({
      screenX,
      screenY,
      capColLeft: layout.capColLeft,
      listTop: layout.listTop,
      listViewportH: layout.listViewportH,
      listContentY: listContent.y,
      rowStride: layout.rowStride,
      rowH: layout.rowH,
      enemyIds: rows.map((r) => r.enemyId),
      topHitSlopPx: scaleUiY(LIST_VIEWPORT_TOP_HIT_SLOP_PX),
    });
  }

  /** Screen center of a row's name cell, or null when scrolled out of the viewport. */
  rowScreenCenter(row: EnemyRow): { x: number; y: number } | null {
    const { layout, listContent } = this.view;
    const cy = listContent.y + row.bg.y;
    const half = layout.rowH / 2;
    if (
      cy + half < layout.listTop ||
      cy - half > layout.listTop + layout.listViewportH
    ) {
      return null;
    }
    return { x: row.bg.x, y: cy };
  }

  capControlCenter(
    row: EnemyRow,
    which: "minus" | "plus",
  ): { x: number; y: number } | null {
    const { layout, listContent } = this.view;
    const cy = listContent.y + row.capBg.y;
    const half = layout.rowH / 2;
    if (
      cy + half < layout.listTop ||
      cy - half > layout.listTop + layout.listViewportH
    ) {
      return null;
    }
    const obj = which === "minus" ? row.capMinus : row.capPlus;
    return { x: obj.x, y: cy };
  }

  applyScroll(next: number): void {
    const { layout, listContent } = this.view;
    this.scrollYValue = Phaser.Math.Clamp(next, 0, layout.maxScroll);
    listContent.y = layout.listTop - this.scrollYValue;
    this.refreshScrollbar();
  }

  private refreshScrollbar(): void {
    const { layout, scrollTrack, scrollThumb } = this.view;
    layoutRosterScrollbar(layout, this.scrollYValue, scrollTrack, scrollThumb);
  }
}
