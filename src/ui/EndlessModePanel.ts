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
  private scrollY = 0;
  private readonly maxScroll: number;
  private dragPointerId: number | null = null;
  private dragStartScroll = 0;
  private dragStartPointerY = 0;
  private dragAccum = 0;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
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

    const rowW = GAME.width - scaleUiX(48);
    const rowH = scaleUiY(44);
    const gap = scaleUiY(8);
    const rowStride = rowH + gap;

    const footerBlockH =
      scaleUiY(48) + scaleUiY(56) + scaleUiY(28);
    this.listTop = scaleUiY(148);
    const listBottom = GAME.height - footerBlockH;
    this.listViewportH = Math.max(scaleUiY(120), listBottom - this.listTop);

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
    this.root.add(this.startBtn.container);

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
    this.root.add(this.closeBtn.container);

    this.listViewport = scene.add
      .rectangle(
        GAME.width / 2,
        this.listTop + this.listViewportH / 2,
        rowW,
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
      const cy = localY + rowH / 2;
      const bg = scene.add
        .rectangle(GAME.width / 2, cy, rowW, rowH, 0x3f3f46, 1)
        .setStrokeStyle(2, 0x71717a);
      const text = scene.add
        .text(GAME.width / 2, cy, label, uiTextStyle(scene, {
          fontSize: `${scaleUiX(16)}px`,
          color: "#fafafa",
        }))
        .setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      this.wireRowPointer(bg, enemyId);
      this.rows.push({ enemyId, label, bg, text });
      this.listContent.add([bg, text]);
      localY += rowStride;
    }

    this.contentHeight = Math.max(localY - gap, rowH);
    this.maxScroll = Math.max(0, this.contentHeight - this.listViewportH);

    this.maskGraphics = scene.make.graphics({ x: 0, y: 0 }, false);
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(
      (GAME.width - rowW) / 2,
      this.listTop,
      rowW,
      this.listViewportH,
    );
    const mask = this.maskGraphics.createGeometryMask();
    this.listContent.setMask(mask);

    this.wireListViewportDrag();

    this.selectedId = enemyIds[0] ?? null;
    this.refreshSelection();
    this.applyScroll(0);

    this.onWheel = (_pointer, _objects, _dx, deltaY) => {
      if (deltaY === 0) return;
      this.applyScroll(this.scrollY + deltaY * 0.35);
    };
    scene.input.on("wheel", this.onWheel);
  }

  private wireRowPointer(
    bg: Phaser.GameObjects.Rectangle,
    enemyId: string,
  ): void {
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.beginDrag(pointer);
    });
    bg.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      this.continueDrag(pointer);
    });
    bg.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      const tapped = this.endDrag();
      if (tapped) this.select(enemyId);
    });
    bg.on("pointerout", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      this.endDrag();
    });
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
      this.endDrag();
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

  private applyScroll(next: number): void {
    this.scrollY = Phaser.Math.Clamp(next, 0, this.maxScroll);
    this.listContent.y = this.listTop - this.scrollY;
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

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    for (const row of this.rows) {
      const r = interactiveObjectScreenRect(row.bg);
      if (!r) continue;
      out[`endless-enemy-${row.enemyId}`] = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
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
  } {
    return {
      scrollY: this.scrollY,
      maxScroll: this.maxScroll,
      listTop: this.listTop,
      listViewportH: this.listViewportH,
      contentHeight: this.contentHeight,
    };
  }

  e2eStartWithEnemy(enemyId: string): void {
    this.select(enemyId);
    this.onStart(enemyId);
    this.destroy();
  }
}