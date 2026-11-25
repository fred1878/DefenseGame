import type Phaser from "phaser";
import type { DataStore, WaveGroup } from "../core/DataStore";
import type { ModalInputLease } from "../input/modalBackdrop";
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
  paintRosterRowSelection,
  setRosterStartEnabled,
} from "./rosterPanelShared";
import {
  type createTouchButton,
  interactiveObjectScreenRect,
} from "./touchButton";
import {
  buildWavePlannerPanelUi,
  type NumField,
  type PlannerRow,
} from "./wavePlanner/WavePlannerPanelBuild";
import { WavePlannerPanelScroll } from "./wavePlanner/WavePlannerPanelScroll";

/**
 * Town overlay: pick foes, counts, spawn timing, then run a simulated defense wave.
 * UI build and list scrolling live in `ui/wavePlanner/`.
 */
export class WavePlannerPanel {
  private readonly store: DataStore;
  private readonly root: Phaser.GameObjects.Container;
  private readonly rows: PlannerRow[];
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
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly scroll: WavePlannerPanelScroll;

  constructor(
    scene: Phaser.Scene,
    store: DataStore,
    onStart: (groups: WaveGroup[]) => void,
    onDismiss?: () => void,
  ) {
    this.store = store;
    this.onStart = onStart;
    this.onDismiss = onDismiss;

    const enemyIds = listPlayableDefenseEnemyIds(store);
    if (enemyIds.length === 0) enemyIds.push("grunt");

    const scroll = new WavePlannerPanelScroll(scene, (id) => this.toggleSelect(id));
    this.scroll = scroll;
    const ui = buildWavePlannerPanelUi(
      scene,
      store,
      enemyIds,
      { counts: this.counts, atMs: this.atMs, intervalMs: this.intervalMs },
      {
        onBumpField: (enemyId, field, delta) => this.bumpField(enemyId, field, delta),
        wireListViewport: (listViewport) => scroll.wireListViewportDrag(listViewport),
        onStartPressed: () => {
          const groups = this.buildGroups();
          if (groups.length === 0) return;
          this.onStart(groups);
          this.destroy();
        },
        onClosePressed: () => this.destroy(),
      },
    );
    this.root = ui.root;
    this.modalLease = ui.modalLease;
    this.rows = ui.rows;
    this.maskGraphics = ui.maskGraphics;
    this.challengeRatingText = ui.challengeRatingText;
    this.startBtn = ui.startBtn;
    this.closeBtn = ui.closeBtn;
    scroll.attach({
      listContent: ui.listContent,
      scrollTrack: ui.scrollTrack,
      scrollThumb: ui.scrollThumb,
      layout: ui.layout,
      rows: ui.rows,
    });

    const first = enemyIds[0];
    if (first) this.selectedIds.add(first);
    this.refreshSelection();
    this.refreshStartButton();
    this.refreshChallengeRating();
    scroll.applyScroll(0);
    scroll.bindWheel();
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
      paintRosterRowSelection(row, on);
      const alpha = on ? 1 : 0.55;
      for (const key of ["count", "atMs", "intervalMs"] as const) {
        row.minus[key].setAlpha(alpha);
        row.plus[key].setAlpha(alpha);
        row.values[key].setAlpha(alpha);
      }
    }
  }

  private refreshStartButton(): void {
    setRosterStartEnabled(this.startBtn, this.selectedIds.size > 0);
  }

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.modalLease.release();
    this.scroll.unbindWheel();
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
