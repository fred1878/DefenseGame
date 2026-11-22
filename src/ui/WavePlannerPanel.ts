import Phaser from "phaser";
import { GAME } from "../config";
import type { DataStore, WaveGroup } from "../core/DataStore";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { INPUT_MODALITY } from "../input/inputModality";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../input/modalBackdrop";
import { listPlayableDefenseEnemyIds } from "../systems/endlessEnemyRoster";
import { sumChallengeRating } from "../systems/challengeRating";
import {
  clampWavePlannerCount,
  clampWavePlannerTimeMs,
  WAVE_PLANNER_COUNT_MIN,
  WAVE_PLANNER_DEFAULT_AT_MS,
  WAVE_PLANNER_DEFAULT_INTERVAL_MS,
  WAVE_PLANNER_TIME_STEP_MS,
} from "../systems/wavePlannerTiming";
import {
  createTouchButton,
  interactiveObjectScreenRect,
} from "./touchButton";
import { uiTextStyle } from "./uiTextStyle";
import { createUiRoundedRect } from "./uiRoundedRect";

const TAP_DRAG_THRESHOLD_PX = 10;
const MAX_VISIBLE_ROWS = 5;

type NumField = "count" | "atMs" | "intervalMs";

type PlannerRow = {
  enemyId: string;
  bg: Phaser.GameObjects.Rectangle;
  check: Phaser.GameObjects.Text;
  text: Phaser.GameObjects.Text;
  minus: Record<NumField, ReturnType<typeof createUiRoundedRect>>;
  plus: Record<NumField, ReturnType<typeof createUiRoundedRect>>;
  values: Record<NumField, Phaser.GameObjects.Text>;
};

/**
 * Town overlay: pick foes, counts, spawn timing, then run a simulated defense wave.
 */
export class WavePlannerPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: DataStore;
  private readonly root: Phaser.GameObjects.Container;
  private readonly listContent: Phaser.GameObjects.Container;
  private readonly listViewport: Phaser.GameObjects.Rectangle;
  private readonly rows: PlannerRow[] = [];
  private readonly selectedIds = new Set<string>();
  private readonly counts = new Map<string, number>();
  private readonly atMs = new Map<string, number>();
  private readonly intervalMs = new Map<string, number>();
  private startBtn: ReturnType<typeof createTouchButton> | null = null;
  private closeBtn: ReturnType<typeof createTouchButton> | null = null;
  private challengeRatingText!: Phaser.GameObjects.Text;
  private readonly onStart: (groups: WaveGroup[]) => void;
  private readonly onDismiss: (() => void) | undefined;
  private readonly modalLease: ModalInputLease;
  private tornDown = false;
  private readonly listTop: number;
  private readonly listViewportH: number;
  private readonly contentHeight: number;
  private readonly rowH: number;
  private readonly rowStride: number;
  private readonly rowW: number;
  private readonly nameColW: number;
  private readonly listLeft: number;
  private readonly numericColLeft: number;
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
    onStart: (groups: WaveGroup[]) => void,
    onDismiss?: () => void,
  ) {
    this.scene = scene;
    this.store = store;
    this.onStart = onStart;
    this.onDismiss = onDismiss;

    const enemyIds = listPlayableDefenseEnemyIds(store);
    if (enemyIds.length === 0) enemyIds.push("grunt");

    this.root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

    const dim = scene.add.rectangle(
      GAME.width / 2,
      GAME.height / 2,
      GAME.width,
      GAME.height,
      0x000000,
      0.72,
    );
    bindModalDimBackdrop(dim);
    this.root.add(dim);
    this.modalLease = acquireModalInput(scene, INPUT_MODALITY.townWavePlanner);

    this.root.add(
      scene.add
        .text(
          GAME.width / 2,
          scaleUiY(64),
          "Wave planner",
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(24)}px`,
            color: "#f4f4f5",
          }),
        )
        .setOrigin(0.5),
    );

    this.root.add(
      scene.add
        .text(
          GAME.width / 2,
          scaleUiY(98),
          "Rows: count · spawn at (ms) · interval (ms) — timing adjusts by 100. Simulated night; no gold or night advance.",
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(13)}px`,
            color: "#a1a1aa",
            align: "center",
            wordWrap: { width: GAME.width - scaleUiX(36) },
          }),
        )
        .setOrigin(0.5, 0),
    );

    this.rowW = GAME.width - scaleUiX(48);
    this.nameColW = scaleUiX(152);
    this.listLeft = (GAME.width - this.rowW) / 2;
    this.numericColLeft = this.listLeft + this.nameColW;
    this.rowH = scaleUiY(50);
    const gap = scaleUiY(8);
    this.rowStride = this.rowH + gap;

    const footerBlockH = scaleUiY(22) + scaleUiY(48) + scaleUiY(56) + scaleUiY(36);
    this.listTop = scaleUiY(156);
    const listBottom = GAME.height - footerBlockH;
    const listBudget = Math.max(scaleUiY(100), listBottom - this.listTop);
    const cappedByRows = MAX_VISIBLE_ROWS * this.rowStride - gap;
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

    const numColW = (this.rowW - this.nameColW) / 3;
    const colCenters = [0, 1, 2].map(
      (i) => this.numericColLeft + numColW * i + numColW / 2,
    );

    let localY = 0;
    const seedCount = Math.max(
      WAVE_PLANNER_COUNT_MIN,
      store.player.endlessPanelDefaultConcurrent,
    );
    for (const enemyId of enemyIds) {
      const def = store.enemies[enemyId];
      const label = def?.displayName ?? enemyId;
      const cy = localY + this.rowH / 2;
      const nameCx = this.listLeft + this.nameColW / 2;

      const bg = scene.add
        .rectangle(nameCx, cy, this.nameColW, this.rowH, 0x3f3f46, 1)
        .setStrokeStyle(2, 0x71717a);
      const check = scene.add
        .text(
          this.listLeft + scaleUiX(12),
          cy,
          "☐",
          uiTextStyle(scene, { fontSize: `${scaleUiX(16)}px`, color: "#a1a1aa" }),
        )
        .setOrigin(0.5);
      const text = scene.add
        .text(nameCx + scaleUiX(6), cy, label, uiTextStyle(scene, {
          fontSize: `${scaleUiX(13)}px`,
          color: "#fafafa",
        }))
        .setOrigin(0.5);

      this.counts.set(enemyId, seedCount);
      this.atMs.set(enemyId, WAVE_PLANNER_DEFAULT_AT_MS);
      this.intervalMs.set(enemyId, WAVE_PLANNER_DEFAULT_INTERVAL_MS);

      const minus: PlannerRow["minus"] = {
        count: null!,
        atMs: null!,
        intervalMs: null!,
      };
      const plus: PlannerRow["plus"] = { count: null!, atMs: null!, intervalMs: null! };
      const values: PlannerRow["values"] = {
        count: null!,
        atMs: null!,
        intervalMs: null!,
      };

      const fields: { key: NumField; centerIndex: number }[] = [
        { key: "count", centerIndex: 0 },
        { key: "atMs", centerIndex: 1 },
        { key: "intervalMs", centerIndex: 2 },
      ];
      for (const { key, centerIndex } of fields) {
        const cx = colCenters[centerIndex]!;
        const btnW = scaleUiX(22);
        const btnH = scaleUiY(26);
        const m = createUiRoundedRect(scene, btnW, btnH, 0x3f3f46, 0x71717a);
        m.setPosition(cx - scaleUiX(22), cy)
          .setInteractive(
            new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
            Phaser.Geom.Rectangle.Contains,
          );
        const p = createUiRoundedRect(scene, btnW, btnH, 0x3f3f46, 0x71717a);
        p.setPosition(cx + scaleUiX(22), cy)
          .setInteractive(
            new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
            Phaser.Geom.Rectangle.Contains,
          );
        m.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          pointer.event.stopPropagation();
          this.bumpField(enemyId, key, -1);
        });
        p.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          pointer.event.stopPropagation();
          this.bumpField(enemyId, key, 1);
        });
        minus[key] = m;
        plus[key] = p;
        const initial =
          key === "count"
            ? String(this.counts.get(enemyId))
            : key === "atMs"
              ? String(this.atMs.get(enemyId))
              : String(this.intervalMs.get(enemyId));
        values[key] = scene.add
          .text(cx, cy, initial ?? "0", uiTextStyle(scene, {
            fontSize: `${scaleUiX(12)}px`,
            color: "#e4e4e7",
          }))
          .setOrigin(0.5);
      }

      const row: PlannerRow = {
        enemyId,
        bg,
        check,
        text,
        minus,
        plus,
        values,
      };
      this.rows.push(row);
      this.listContent.add([
        bg,
        check,
        text,
        minus.count,
        plus.count,
        values.count,
        minus.atMs,
        plus.atMs,
        values.atMs,
        minus.intervalMs,
        plus.intervalMs,
        values.intervalMs,
      ]);
      localY += this.rowStride;
    }

    this.contentHeight = Math.max(localY - gap, this.rowH);
    this.maxScroll = Math.max(0, this.contentHeight - this.listViewportH);

    const trackW = scaleUiX(6);
    const trackX = (GAME.width + this.rowW) / 2 + scaleUiX(4) + trackW / 2;
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
    this.listContent.setMask(this.maskGraphics.createGeometryMask());

    this.wireListViewportDrag();

    const footerAnchorY = listBottom + scaleUiY(11);
    const crTextY = footerAnchorY - scaleUiY(5);
    this.challengeRatingText = scene.add
      .text(
        GAME.width / 2,
        crTextY,
        "Challenge rating: 0",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(14)}px`,
          color: "#fbbf24",
        }),
      )
      .setOrigin(0.5);
    this.root.add(this.challengeRatingText);

    const startY = footerAnchorY + scaleUiY(26);
    this.startBtn = createTouchButton(
      scene,
      GAME.width / 2,
      startY,
      "Start wave",
      () => {
        const groups = this.buildGroups();
        if (groups.length === 0) return;
        this.onStart(groups);
        this.destroy();
      },
      {
        width: scaleUiX(200),
        height: scaleUiY(48),
        depth: 510,
        fontSize: `${scaleUiX(16)}px`,
        fillColor: 0x15803d,
        strokeColor: 0x4ade80,
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
    this.refreshChallengeRating();
    this.applyScroll(0);

    this.onWheel = (_pointer, _objects, _dx, deltaY) => {
      if (deltaY === 0) return;
      this.applyScroll(this.scrollY + deltaY * 0.35);
    };
    scene.input.on("wheel", this.onWheel);
  }

  private bumpField(enemyId: string, field: NumField, delta: number): void {
    if (field === "count") {
      const next = clampWavePlannerCount(
        (this.counts.get(enemyId) ?? WAVE_PLANNER_COUNT_MIN) + delta,
      );
      this.counts.set(enemyId, next);
    } else if (field === "atMs") {
      const next = clampWavePlannerTimeMs(
        (this.atMs.get(enemyId) ?? 0) + delta * WAVE_PLANNER_TIME_STEP_MS,
      );
      this.atMs.set(enemyId, next);
    } else {
      const next = clampWavePlannerTimeMs(
        (this.intervalMs.get(enemyId) ?? WAVE_PLANNER_DEFAULT_INTERVAL_MS) +
          delta * WAVE_PLANNER_TIME_STEP_MS,
      );
      this.intervalMs.set(enemyId, next);
    }
    const row = this.rows.find((r) => r.enemyId === enemyId);
    if (row) {
      row.values.count.setText(`${this.counts.get(enemyId)}`);
      row.values.atMs.setText(`${this.atMs.get(enemyId)}`);
      row.values.intervalMs.setText(`${this.intervalMs.get(enemyId)}`);
    }
    this.refreshChallengeRating();
  }

  private buildGroups(): WaveGroup[] {
    return [...this.selectedIds].map((enemyId) => ({
      enemyId,
      count: this.counts.get(enemyId) ?? WAVE_PLANNER_COUNT_MIN,
      atMs: this.atMs.get(enemyId) ?? WAVE_PLANNER_DEFAULT_AT_MS,
      intervalMs:
        this.intervalMs.get(enemyId) ?? WAVE_PLANNER_DEFAULT_INTERVAL_MS,
    }));
  }

  private refreshChallengeRating(): void {
    const rows = this.buildGroups().map((g) => ({
      enemyId: g.enemyId,
      count: g.count,
    }));
    this.challengeRatingText.setText(
      `Challenge rating: ${sumChallengeRating(this.store, rows)}`,
    );
  }

  private wireListViewportDrag(): void {
    this.listViewport.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.dragPointerId = pointer.id;
      this.dragStartScroll = this.scrollY;
      this.dragStartPointerY = pointer.y;
      this.dragAccum = 0;
    });
    this.listViewport.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      const dy = pointer.y - this.dragStartPointerY;
      this.dragAccum = Math.max(this.dragAccum, Math.abs(dy));
      this.applyScroll(this.dragStartScroll - dy);
    });
    this.listViewport.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointerId !== pointer.id) return;
      const tapped = this.dragAccum < TAP_DRAG_THRESHOLD_PX;
      this.dragPointerId = null;
      this.dragAccum = 0;
      if (!tapped) return;
      if (pointer.x >= this.numericColLeft) return;
      const enemyId = this.pickVisibleRowAtScreen(pointer.x, pointer.y);
      if (enemyId) this.toggleSelect(enemyId);
    });
  }

  private pickVisibleRowAtScreen(screenX: number, screenY: number): string | null {
    if (screenX >= this.numericColLeft) return null;
    if (screenY < this.listTop || screenY > this.listTop + this.listViewportH) {
      return null;
    }
    const contentY = screenY - this.listContent.y;
    const index = Math.floor(contentY / this.rowStride);
    if (index < 0 || index >= this.rows.length) return null;
    return this.rows[index]!.enemyId;
  }

  private applyScroll(next: number): void {
    this.scrollY = Phaser.Math.Clamp(next, 0, this.maxScroll);
    this.listContent.y = this.listTop - this.scrollY;
    const show = this.maxScroll > 0;
    this.scrollTrack.setVisible(show);
    this.scrollThumb.setVisible(show);
    if (!show) return;
    const trackH = this.listViewportH;
    const minThumb = scaleUiY(28);
    const thumbH = Math.max(minThumb, (this.listViewportH / this.contentHeight) * trackH);
    const travel = Math.max(0, trackH - thumbH);
    const thumbY =
      this.listTop + (this.maxScroll > 0 ? (this.scrollY / this.maxScroll) * travel : 0);
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
    this.refreshChallengeRating();
  }

  private refreshSelection(): void {
    for (const row of this.rows) {
      const on = this.selectedIds.has(row.enemyId);
      row.bg.setFillStyle(on ? 0x1e3a5f : 0x3f3f46);
      row.bg.setStrokeStyle(2, on ? 0x60a5fa : 0x71717a);
      row.check.setText(on ? "☑" : "☐");
      row.check.setColor(on ? "#93c5fd" : "#a1a1aa");
      const alpha = on ? 1 : 0.55;
      for (const key of ["count", "atMs", "intervalMs"] as const) {
        row.minus[key].setAlpha(alpha);
        row.plus[key].setAlpha(alpha);
        row.values[key].setAlpha(alpha);
      }
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

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.modalLease.release();
    this.scene.input.off("wheel", this.onWheel);
    if (this.maskGraphics.active) this.maskGraphics.destroy();
    if (this.startBtn?.container.active) this.startBtn.container.destroy();
    if (this.closeBtn?.container.active) this.closeBtn.container.destroy();
    if (this.root.active) this.root.destroy();
    this.onDismiss?.();
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    if (this.startBtn) {
      const r = interactiveObjectScreenRect(this.startBtn.container);
      if (r) {
        out["wave-planner-start"] = {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
        };
      }
    }
    if (this.closeBtn) {
      const r = interactiveObjectScreenRect(this.closeBtn.container);
      if (r) {
        out["wave-planner-close"] = {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
        };
      }
    }
    return out;
  }
}