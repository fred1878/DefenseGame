import Phaser from "phaser";
import { GAME } from "../config";
import type { DataStore } from "../core/DataStore";
import type { EndlessRunSelection } from "../core/defenseRunMode";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { listPlayableDefenseEnemyIds } from "../systems/endlessEnemyRoster";
import {
  clampEndlessConcurrent,
  ENDLESS_CONCURRENT_MIN,
} from "../systems/endlessSpawnScheduler";
import {
  createTouchButton,
  interactiveObjectScreenRect,
} from "./touchButton";
import { uiTextStyle } from "./uiTextStyle";
import {
  createUiRoundedRect,
  paintUiRoundedRect,
  type UiRoundedRect,
} from "./uiRoundedRect";

const TAP_DRAG_THRESHOLD_PX = 10;
/** Max roster rows visible before scrolling. */
const MAX_VISIBLE_ROWS = 6;

type EnemyRow = {
  enemyId: string;
  label: string;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  check: Phaser.GameObjects.Text;
  capBg: Phaser.GameObjects.Rectangle;
  capMinus: UiRoundedRect;
  capPlus: UiRoundedRect;
  capValue: Phaser.GameObjects.Text;
  capLocalY: number;
};

/**
 * Town overlay: multi-select foes, per-type concurrent caps, then start endless defense.
 */
export class EndlessModePanel {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly listContent: Phaser.GameObjects.Container;
  private readonly listViewport: Phaser.GameObjects.Rectangle;
  private readonly rows: EnemyRow[] = [];
  private readonly selectedIds = new Set<string>();
  private readonly caps = new Map<string, number>();
  private startBtn: ReturnType<typeof createTouchButton> | null = null;
  private closeBtn: ReturnType<typeof createTouchButton> | null = null;
  private readonly onStart: (
    selections: EndlessRunSelection[],
    infiniteHp: boolean,
  ) => void;
  private infiniteHp = false;
  private infiniteHpBg!: UiRoundedRect;
  private infiniteHpCheck!: Phaser.GameObjects.Text;
  private infiniteHpRowY = 0;
  private readonly listTop: number;
  private readonly listViewportH: number;
  private readonly contentHeight: number;
  private readonly rowH: number;
  private readonly rowStride: number;
  private readonly rowW: number;
  private readonly nameColW: number;
  private readonly capColW: number;
  private readonly listLeft: number;
  private scrollY = 0;
  private readonly maxScroll: number;
  /** Suppresses roster toggle when a cap stepper consumed the pointer. */
  private capStepperPointerId: number | null = null;
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
    onStart: (selections: EndlessRunSelection[], infiniteHp: boolean) => void,
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
        "Pick one or more foes — set on-screen caps — train until you fall or leave. No gold, no night advance.",
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
    this.capColW = scaleUiX(96);
    this.nameColW = this.rowW - this.capColW - scaleUiX(4);
    this.listLeft = (GAME.width - this.rowW) / 2;
    this.rowH = scaleUiY(44);
    const gap = scaleUiY(8);
    this.rowStride = this.rowH + gap;

    const infiniteRowH = scaleUiY(44);
    const footerBlockH =
      scaleUiY(12) +
      infiniteRowH +
      scaleUiY(16) +
      scaleUiY(48) +
      scaleUiY(56) +
      scaleUiY(28);
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
      const nameCx = this.listLeft + this.nameColW / 2;
      const capCx = this.listLeft + this.nameColW + scaleUiX(4) + this.capColW / 2;

      const bg = scene.add
        .rectangle(nameCx, cy, this.nameColW, this.rowH, 0x3f3f46, 1)
        .setStrokeStyle(2, 0x71717a);
      const check = scene.add
        .text(
          this.listLeft + scaleUiX(14),
          cy,
          "☐",
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(18)}px`,
            color: "#a1a1aa",
          }),
        )
        .setOrigin(0.5);
      const text = scene.add
        .text(nameCx + scaleUiX(8), cy, label, uiTextStyle(scene, {
          fontSize: `${scaleUiX(15)}px`,
          color: "#fafafa",
        }))
        .setOrigin(0.5);

      const capBg = scene.add
        .rectangle(capCx, cy, this.capColW, this.rowH, 0x27272a, 1)
        .setStrokeStyle(2, 0x52525b);

      const capBtnW = scaleUiX(28);
      const capBtnH = scaleUiY(30);
      const minusX = capCx - scaleUiX(24);
      const plusX = capCx + scaleUiX(24);
      const capMinus = createUiRoundedRect(
        scene,
        capBtnW,
        capBtnH,
        0x3f3f46,
        0x71717a,
      );
      capMinus
        .setPosition(minusX, cy)
        .setInteractive(
          new Phaser.Geom.Rectangle(-capBtnW / 2, -capBtnH / 2, capBtnW, capBtnH),
          Phaser.Geom.Rectangle.Contains,
        );
      const capPlus = createUiRoundedRect(
        scene,
        capBtnW,
        capBtnH,
        0x3f3f46,
        0x71717a,
      );
      capPlus
        .setPosition(plusX, cy)
        .setInteractive(
          new Phaser.Geom.Rectangle(-capBtnW / 2, -capBtnH / 2, capBtnW, capBtnH),
          Phaser.Geom.Rectangle.Contains,
        );
      /** UI seed from `player.json` only — defense spawns use `buildSelections()` caps. */
      const capDefault = store.player.endlessPanelDefaultConcurrent;
      this.caps.set(enemyId, capDefault);
      const capValue = scene.add
        .text(capCx, cy, `${capDefault}`, uiTextStyle(scene, {
          fontSize: `${scaleUiX(15)}px`,
          color: "#e4e4e7",
        }))
        .setOrigin(0.5);

      const wireCapStepper = (stepper: UiRoundedRect, delta: number) => {
        stepper.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          this.capStepperPointerId = pointer.id;
        });
        stepper.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (this.capStepperPointerId === pointer.id) {
            this.capStepperPointerId = null;
          }
          this.bumpCap(enemyId, delta);
        });
      };
      wireCapStepper(capMinus, -1);
      wireCapStepper(capPlus, 1);

      const row: EnemyRow = {
        enemyId,
        label,
        bg,
        text,
        check,
        capBg,
        capMinus,
        capPlus,
        capValue,
        capLocalY: localY,
      };
      this.rows.push(row);
      this.listContent.add([
        bg,
        check,
        text,
        capBg,
        capMinus,
        capValue,
        capPlus,
      ]);
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
      this.listLeft,
      this.listTop,
      this.rowW,
      this.listViewportH,
    );
    const mask = this.maskGraphics.createGeometryMask();
    this.listContent.setMask(mask);

    this.wireListViewportDrag();

    this.infiniteHpRowY = listBottom + scaleUiY(12) + infiniteRowH / 2;
    this.infiniteHpBg = createUiRoundedRect(
      scene,
      this.rowW,
      infiniteRowH,
      0x27272a,
      0x52525b,
    );
    this.infiniteHpBg
      .setPosition(GAME.width / 2, this.infiniteHpRowY)
      .setInteractive(
        new Phaser.Geom.Rectangle(
          -this.rowW / 2,
          -infiniteRowH / 2,
          this.rowW,
          infiniteRowH,
        ),
        Phaser.Geom.Rectangle.Contains,
      );
    this.infiniteHpBg.on("pointerup", () => this.toggleInfiniteHp());
    this.infiniteHpCheck = scene.add
      .text(
        this.listLeft + scaleUiX(14),
        this.infiniteHpRowY,
        "☐",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(18)}px`,
          color: "#a1a1aa",
        }),
      )
      .setOrigin(0.5);
    const infiniteLabel = scene.add
      .text(
        this.listLeft + scaleUiX(36),
        this.infiniteHpRowY,
        "Infinite HP",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(15)}px`,
          color: "#fafafa",
        }),
      )
      .setOrigin(0, 0.5);
    this.root.add([
      this.infiniteHpBg,
      this.infiniteHpCheck,
      infiniteLabel,
    ]);

    const startY = listBottom + scaleUiY(12) + infiniteRowH + scaleUiY(16) + scaleUiY(24);
    this.startBtn = createTouchButton(
      scene,
      GAME.width / 2,
      startY,
      "Start endless",
      () => {
        const selections = this.buildSelections();
        if (selections.length === 0) return;
        this.onStart(selections, this.infiniteHp);
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

    const first = enemyIds[0];
    if (first) this.selectedIds.add(first);
    this.refreshSelection();
    this.refreshStartButton();
    this.applyScroll(0);

    this.onWheel = (_pointer, _objects, _dx, deltaY) => {
      if (deltaY === 0) return;
      this.applyScroll(this.scrollY + deltaY * 0.35);
    };
    scene.input.on("wheel", this.onWheel);
  }

  private bumpCap(enemyId: string, delta: number): void {
    const cur = this.caps.get(enemyId) ?? ENDLESS_CONCURRENT_MIN;
    const next = clampEndlessConcurrent(cur + delta);
    this.caps.set(enemyId, next);
    const row = this.rows.find((r) => r.enemyId === enemyId);
    row?.capValue.setText(`${next}`);
  }

  private buildSelections(): EndlessRunSelection[] {
    return [...this.selectedIds].map((enemyId) => ({
      enemyId,
      concurrentCap: this.caps.get(enemyId) ?? ENDLESS_CONCURRENT_MIN,
    }));
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
      if (this.capStepperPointerId === pointer.id) {
        this.capStepperPointerId = null;
        return;
      }
      if (tapped) {
        const enemyId = this.pickVisibleRosterRowAtScreen(pointer.x, pointer.y);
        if (enemyId) this.toggleSelect(enemyId);
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

  private pickVisibleRosterRowAtScreen(
    screenX: number,
    screenY: number,
  ): string | null {
    if (
      screenX < this.listLeft ||
      screenX > this.listLeft + this.nameColW
    ) {
      return null;
    }
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
    return { x: row.bg.x, y: cy };
  }

  private capControlCenter(
    row: EnemyRow,
    which: "minus" | "plus",
  ): { x: number; y: number } | null {
    const cy = this.listContent.y + row.capBg.y;
    const half = this.rowH / 2;
    if (cy + half < this.listTop || cy - half > this.listTop + this.listViewportH) {
      return null;
    }
    const obj = which === "minus" ? row.capMinus : row.capPlus;
    return { x: obj.x, y: cy };
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

  private toggleSelect(enemyId: string): void {
    if (this.selectedIds.has(enemyId)) {
      this.selectedIds.delete(enemyId);
    } else {
      this.selectedIds.add(enemyId);
    }
    this.refreshSelection();
    this.refreshStartButton();
  }

  private refreshSelection(): void {
    for (const row of this.rows) {
      const on = this.selectedIds.has(row.enemyId);
      row.bg.setFillStyle(on ? 0x1e3a5f : 0x3f3f46);
      row.bg.setStrokeStyle(2, on ? 0x60a5fa : 0x71717a);
      row.check.setText(on ? "☑" : "☐");
      row.check.setColor(on ? "#93c5fd" : "#a1a1aa");
      row.capBg.setStrokeStyle(2, on ? 0x52525b : 0x3f3f46);
      row.capMinus.setAlpha(on ? 1 : 0.65);
      row.capPlus.setAlpha(on ? 1 : 0.65);
      row.capValue.setAlpha(on ? 1 : 0.65);
    }
  }

  private refreshStartButton(): void {
    const enabled = this.selectedIds.size > 0;
    const btn = this.startBtn?.container;
    if (!btn) return;
    btn.setAlpha(enabled ? 1 : 0.45);
    if (enabled) btn.setInteractive();
    else btn.disableInteractive();
  }

  private toggleInfiniteHp(): void {
    this.infiniteHp = !this.infiniteHp;
    paintUiRoundedRect(
      this.infiniteHpBg,
      this.infiniteHp ? 0x1e3a5f : 0x27272a,
      this.infiniteHp ? 0x60a5fa : 0x52525b,
    );
    this.infiniteHpCheck.setText(this.infiniteHp ? "☑" : "☐");
    this.infiniteHpCheck.setColor(this.infiniteHp ? "#93c5fd" : "#a1a1aa");
  }

  destroy(): void {
    this.scene.input.off("wheel", this.onWheel);
    this.maskGraphics.destroy();
    this.startBtn?.container.destroy();
    this.closeBtn?.container.destroy();
    this.root.destroy();
  }

  e2eSelectedEnemyId(): string | null {
    const first = [...this.selectedIds][0];
    return first ?? null;
  }

  e2eSelectedEnemyIds(): string[] {
    return [...this.selectedIds].sort();
  }

  e2eRosterEnemyIds(): string[] {
    return this.rows.map((r) => r.enemyId);
  }

  e2eEnemyConcurrentCap(enemyId: string): number | null {
    return this.caps.get(enemyId) ?? null;
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    for (const row of this.rows) {
      const center = this.rowScreenCenter(row);
      if (!center) continue;
      out[`endless-enemy-${row.enemyId}`] = center;
      const minus = this.capControlCenter(row, "minus");
      const plus = this.capControlCenter(row, "plus");
      if (minus) out[`endless-cap-minus-${row.enemyId}`] = minus;
      if (plus) out[`endless-cap-plus-${row.enemyId}`] = plus;
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
    out["endless-infinite-hp"] = {
      x: GAME.width / 2,
      y: this.infiniteHpRowY,
    };
    return out;
  }

  e2eInfiniteHpEnabled(): boolean {
    return this.infiniteHp;
  }

  e2eSetInfiniteHp(enabled: boolean): void {
    if (this.infiniteHp !== enabled) this.toggleInfiniteHp();
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

  e2eStartWithEnemy(enemyId: string, infiniteHp = false): void {
    this.selectedIds.clear();
    this.selectedIds.add(enemyId);
    this.refreshSelection();
    this.e2eSetInfiniteHp(infiniteHp);
    const selections = this.buildSelections();
    this.onStart(selections, this.infiniteHp);
    this.destroy();
  }

  e2eToggleEnemy(enemyId: string): void {
    this.toggleSelect(enemyId);
  }

  e2eSetEnemyCap(enemyId: string, cap: number): void {
    this.caps.set(enemyId, clampEndlessConcurrent(cap));
    const row = this.rows.find((r) => r.enemyId === enemyId);
    row?.capValue.setText(`${this.caps.get(enemyId)}`);
  }
}