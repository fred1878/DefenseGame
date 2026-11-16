import Phaser from "phaser";
import { GAME } from "../config";
import type { DataStore } from "../core/DataStore";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { listPlayableDefenseEnemyIds } from "../systems/endlessEnemyRoster";
import {
  createTouchButton,
  interactiveObjectScreenRect,
} from "./touchButton";
import { uiTextStyle } from "./uiTextStyle";

const TAP_DRAG_THRESHOLD_PX = 10;
/** Max roster rows visible before scrolling (tighter list viewport). */
const MAX_VISIBLE_ROWS = 4;

type EnemyRow = {
  enemyId: string;
  label: string;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
};

/**
 * Town overlay: pick an enemy roster entry, then start endless defense.
 */
export class EndlessModePanel {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly listContent: Phaser.GameObjects.Container;
  private readonly listViewport: Phaser.GameObjects.Rectangle;
  private readonly rows: EnemyRow[] = [];
  private selectedId: string | null = null;
  private startBtn: ReturnType<typeof createTouchButton> | null = null;
  private closeBtn: ReturnType<typeof createTouchButton> | null = null;
  private readonly onStart: (enemyId: string) => void;
  private readonly listTop: number;
  private readonly listViewportH: number;
  private readonly contentHeight: number;
  private readonly rowH: number;
  private readonly rowStride: number;
  private readonly rowW: number;
  private scrollY = 0;
  private readonly maxScroll: number;
  private dragPointerId: number | null = null;
  private dragStartScroll = 0;
  private dragStartPointerY = 0;
  private dragAccum = 0;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly scrollTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollThumb: Phaser.GameObjects.Rectangle;
  private readonly onWheel: (
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ) => void;

  constructor(
    scene: Phaser.Scene,
    store: DataStore,
    onStart: (enemyId: string) => void,
  ) {
    this.scene = scene;
    this.onStart = onStart;

    const enemyIds = listPlayableDefenseEnemyIds(store);
    if (enemyIds.length === 0) enemyIds.push("grunt");

    this.root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

    const dim = scene.add
      .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x000000, 0.72);
    this.root.add(dim);

    const title = scene.add
      .text(
        GAME.width / 2,
        scaleUiY(64),
        "Endless training",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(24)}px`,
          color: "#f4f4f5",
        }),
      )
      .setOrigin(0.5);
    this.root.add(title);

    const hint = scene.add
      .text(
        GAME.width / 2,
        scaleUiY(98),
        "Pick a foe — one at a time until you fall or leave. No gold, no night advance.",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(13)}px`,
          color: "#a1a1aa",
          align: "center",
          wordWrap: { width: GAME.width - scaleUiX(36) },
        }),
      )
      .setOrigin(0.5, 0);
    this.root.add(hint);

    this.rowW = GAME.width - scaleUiX(48);
    this.rowH = scaleUiY(44);
    const gap = scaleUiY(8);
    this.rowStride = this.rowH + gap;

    const footerBlockH =
      scaleUiY(48) + scaleUiY(56) + scaleUiY(28);
    this.listTop = scaleUiY(148);
    const listBottom = GAME.height - footerBlockH;
    const listBudget = Math.max(scaleUiY(120), listBottom - this.listTop);
    const cappedByRows =
      MAX_VISIBLE_ROWS * this.rowStride - gap;
    this.listViewportH = Math.min(listBudget, cappedByRows);

    this.listViewport = scene.add
      .rectangle(
        GAME.width / 2,
        this.listTop + this.listViewportH / 2,
        this.rowW,
        this.listViewportH,
        0x000000,
        0,
      )
      .setInteractive({ draggable: false });
    this.root.add(this.listViewport);

    this.listContent = scene.add.container(0, this.listTop);
    this.root.add(this.listContent);

    let localY = 0;
    for (const enemyId of enemyIds) {
      const def = store.enemies[enemyId];
      const label = def?.displayName ?? enemyId;
      const cy = localY + this.rowH / 2;
      const bg = scene.add
        .rectangle(GAME.width / 2, cy, this.rowW, this.rowH, 0x3f3f46, 1)
        .setStrokeStyle(2, 0x71717a);
      const text = scene.add
        .text(GAME.width / 2, cy, label, uiTextStyle(scene, {
          fontSize: `${scaleUiX(16)}px`,
          color: "#fafafa",
        }))
        .setOrigin(0.5);
      this.rows.push({ enemyId, label, bg, text });
      this.listContent.add([bg, text]);
      localY += this.rowStride;
    }

    this.contentHeight = Math.max(localY - gap, this.rowH);
    this.maxScroll = Math.max(0, this.contentHeight - this.listViewportH);

    const trackW = scaleUiX(6);
    const trackX =
      (GAME.width + this.rowW) / 2 + scaleUiX(4) + trackW / 2;
    this.scrollTrack = scene.add
      .rectangle(
        trackX,
        this.listTop + this.listViewportH / 2,
        trackW,
        this.listViewportH,
        0x3f3f46,
        0.85,
      )
      .setOrigin(0.5)
      .setVisible(this.maxScroll > 0);
    this.scrollThumb = scene.add
      .rectangle(trackX, this.listTop, trackW, scaleUiY(32), 0x71717a, 1)
      .setOrigin(0.5, 0)
      .setVisible(this.maxScroll > 0);
    this.root.add([this.scrollTrack, this.scrollThumb]);

    this.maskGraphics = scene.make.graphics({ x: 0, y: 0 }, false);
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(
      (GAME.width - this.rowW) / 2,
      this.listTop,
      this.rowW,
      this.listViewportH,
    );
    const mask = this.maskGraphics.createGeometryMask();
    this.listContent.setMask(mask);

    this.wireListViewportDrag();

    const startY = listBottom + scaleUiY(24);
    this.startBtn = createTouchButton(
      scene,
      GAME.width / 2,
      startY,
      "Start endless",
      () => {
        if (!this.selectedId) return;
        this.onStart(this.selectedId);
        this.destroy();
      },
      {
        width: scaleUiX(200),
        height: scaleUiY(48),
        depth: 510,
        fontSize: `${scaleUiX(16)}px`,
        fillColor: 0x1d4ed8,
        strokeColor: 0x93c5fd,
      },
    );
    this.closeBtn = createTouchButton(
      scene,
      GAME.width / 2,
      startY + scaleUiY(56),
      "Close",
      () => this.destroy(),
      {
        width: scaleUiX(120),
        height: scaleUiY(40),
        depth: 510,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x52525b,
        strokeColor: 0xa1a1aa,
      },
    );
    this.root.add([this.startBtn.container, this.closeBtn.container]);

    this.selectedId = enemyIds[0] ?? null;
    this.refreshSelection();
    this.applyScroll(0);

    this.onWheel = (_pointer, _objects, _dx, deltaY) => {
      if (deltaY === 0) return;
      this.applyScroll(this.scrollY + deltaY * 0.35);
    };
    scene.input.on("wheel", this.onWheel);
  }

  private wireListViewportDrag(): void {
    this.listViewport.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.beginDrag(pointer);
    });
    this.listViewport.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      this.continueDrag(pointer);
    });
    this.listViewport.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      const tapped = this.endDrag();
      if (tapped) {
        const enemyId = this.pickVisibleRowAtScreenY(pointer.y);
        if (enemyId) this.select(enemyId);
      }
    });
  }

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    this.dragPointerId = pointer.id;
    this.dragStartScroll = this.scrollY;
    this.dragStartPointerY = pointer.y;
    this.dragAccum = 0;
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
    return tapped;
  }

  private pickVisibleRowAtScreenY(screenY: number): string | null {
    if (
      screenY < this.listTop ||
      screenY > this.listTop + this.listViewportH
    ) {
      return null;
    }
    const contentY = screenY - this.listContent.y;
    if (contentY < 0) return null;
    const index = Math.floor(contentY / this.rowStride);
    if (index < 0 || index >= this.rows.length) return null;
    const bandTop = index * this.rowStride;
    const bandBottom = bandTop + this.rowH;
    if (contentY < bandTop || contentY > bandBottom) return null;
    const rowCenterScreen = this.listContent.y + bandTop + this.rowH / 2;
    const half = this.rowH / 2;
    if (
      rowCenterScreen - half < this.listTop - 0.5 ||
      rowCenterScreen + half > this.listTop + this.listViewportH + 0.5
    ) {
      return null;
    }
    return this.rows[index]!.enemyId;
  }

  private rowScreenCenter(
    row: EnemyRow,
  ): { x: number; y: number } | null {
    const cy = this.listContent.y + row.bg.y;
    const half = this.rowH / 2;
    if (cy + half < this.listTop || cy - half > this.listTop + this.listViewportH) {
      return null;
    }
    return { x: GAME.width / 2, y: cy };
  }

  private applyScroll(next: number): void {
    this.scrollY = Phaser.Math.Clamp(next, 0, this.maxScroll);
    this.listContent.y = this.listTop - this.scrollY;
    this.refreshScrollbar();
  }

  private refreshScrollbar(): void {
    const show = this.maxScroll > 0;
    this.scrollTrack.setVisible(show);
    this.scrollThumb.setVisible(show);
    if (!show) return;
    const trackH = this.listViewportH;
    const minThumb = scaleUiY(28);
    const thumbH = Math.max(
      minThumb,
      (this.listViewportH / this.contentHeight) * trackH,
    );
    const travel = Math.max(0, trackH - thumbH);
    const thumbY =
      this.listTop +
      (this.maxScroll > 0 ? (this.scrollY / this.maxScroll) * travel : 0);
    this.scrollThumb.setDisplaySize(this.scrollThumb.width, thumbH);
    this.scrollThumb.y = thumbY;
  }

  private select(enemyId: string): void {
    this.selectedId = enemyId;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    for (const row of this.rows) {
      const on = row.enemyId === this.selectedId;
      row.bg.setFillStyle(on ? 0x1e3a5f : 0x3f3f46);
      row.bg.setStrokeStyle(2, on ? 0x60a5fa : 0x71717a);
    }
  }

  destroy(): void {
    this.scene.input.off("wheel", this.onWheel);
    this.maskGraphics.destroy();
    this.startBtn?.container.destroy();
    this.closeBtn?.container.destroy();
    this.root.destroy();
  }

  e2eSelectedEnemyId(): string | null {
    return this.selectedId;
  }

  e2eRosterEnemyIds(): string[] {
    return this.rows.map((r) => r.enemyId);
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    for (const row of this.rows) {
      const center = this.rowScreenCenter(row);
      if (!center) continue;
      out[`endless-enemy-${row.enemyId}`] = center;
    }
    if (this.startBtn) {
      const r = interactiveObjectScreenRect(this.startBtn.container);
      if (r) {
        out["endless-start"] = {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
        };
      }
    }
    if (this.closeBtn) {
      const r = interactiveObjectScreenRect(this.closeBtn.container);
      if (r) {
        out["endless-close"] = {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
        };
      }
    }
    return out;
  }

  e2eScrollEnemyList(deltaY: number): void {
    this.applyScroll(this.scrollY + deltaY);
  }

  e2eEnemyListScrollState(): {
    scrollY: number;
    maxScroll: number;
    listTop: number;
    listViewportH: number;
    contentHeight: number;
    scrollbarVisible: boolean;
    maxVisibleRows: number;
  } {
    return {
      scrollY: this.scrollY,
      maxScroll: this.maxScroll,
      listTop: this.listTop,
      listViewportH: this.listViewportH,
      contentHeight: this.contentHeight,
      scrollbarVisible: this.maxScroll > 0,
      maxVisibleRows: MAX_VISIBLE_ROWS,
    };
  }

  e2eStartWithEnemy(enemyId: string): void {
    this.select(enemyId);
    this.onStart(enemyId);
    this.destroy();
  }
}