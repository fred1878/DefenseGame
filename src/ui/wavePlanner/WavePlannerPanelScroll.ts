import Phaser from "phaser";
import { layoutRosterScrollbar } from "../panels/rosterPanelShared";
import type {
  PlannerRow,
  WavePlannerListLayout,
} from "./WavePlannerPanelBuild";

const TAP_DRAG_THRESHOLD_PX = 10;

/** List widgets the scroll controller drives (set once by `attach`). */
export type WavePlannerScrollView = {
  listContent: Phaser.GameObjects.Container;
  scrollTrack: Phaser.GameObjects.Rectangle;
  scrollThumb: Phaser.GameObjects.Rectangle;
  layout: WavePlannerListLayout;
  rows: readonly PlannerRow[];
};

/** Roster drag-to-scroll (tap toggles a row), wheel scrolling and scrollbar. */
export class WavePlannerPanelScroll {
  private view!: WavePlannerScrollView;
  private scrollYValue = 0;
  private dragPointerId: number | null = null;
  private dragStartScroll = 0;
  private dragStartPointerY = 0;
  private dragAccum = 0;
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
    /** Called when a tap (not a drag) lands on a row's name column. */
    private readonly onTapRow: (enemyId: string) => void,
  ) {}

  attach(view: WavePlannerScrollView): void {
    this.view = view;
  }

  bindWheel(): void {
    this.scene.input.on("wheel", this.onWheel);
  }

  unbindWheel(): void {
    this.scene.input.off("wheel", this.onWheel);
  }

  wireListViewportDrag(listViewport: Phaser.GameObjects.Rectangle): void {
    listViewport.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.dragPointerId = pointer.id;
      this.dragStartScroll = this.scrollYValue;
      this.dragStartPointerY = pointer.y;
      this.dragAccum = 0;
    });
    listViewport.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      const dy = pointer.y - this.dragStartPointerY;
      this.dragAccum = Math.max(this.dragAccum, Math.abs(dy));
      this.applyScroll(this.dragStartScroll - dy);
    });
    listViewport.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      const tapped = this.dragAccum < TAP_DRAG_THRESHOLD_PX;
      this.dragPointerId = null;
      this.dragAccum = 0;
      if (!tapped) return;
      if (pointer.x >= this.view.layout.numericColLeft) return;
      const enemyId = this.pickVisibleRowAtScreen(pointer.x, pointer.y);
      if (enemyId) this.onTapRow(enemyId);
    });
  }

  private pickVisibleRowAtScreen(
    screenX: number,
    screenY: number,
  ): string | null {
    const { layout, listContent, rows } = this.view;
    if (screenX >= layout.numericColLeft) return null;
    if (
      screenY < layout.listTop ||
      screenY > layout.listTop + layout.listViewportH
    ) {
      return null;
    }
    const contentY = screenY - listContent.y;
    const index = Math.floor(contentY / layout.rowStride);
    if (index < 0 || index >= rows.length) return null;
    return rows[index]!.enemyId;
  }

  applyScroll(next: number): void {
    const { layout, listContent, scrollTrack, scrollThumb } = this.view;
    this.scrollYValue = Phaser.Math.Clamp(next, 0, layout.maxScroll);
    listContent.y = layout.listTop - this.scrollYValue;
    layoutRosterScrollbar(layout, this.scrollYValue, scrollTrack, scrollThumb);
  }
}
