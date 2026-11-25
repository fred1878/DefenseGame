import type Phaser from "phaser";
import type { DataStore } from "../core/DataStore";
import type { EndlessRunSelection } from "../core/defenseRunMode";
import type { ModalInputLease } from "../input/modalBackdrop";
import { listPlayableDefenseEnemyIds } from "../systems/endlessEnemyRoster";
import {
  clampEndlessConcurrent,
  ENDLESS_CONCURRENT_MIN,
} from "../systems/endlessSpawnScheduler";
import { sumChallengeRating } from "../systems/challengeRating";
import {
  paintRosterRowSelection,
  setRosterStartEnabled,
} from "./rosterPanelShared";
import type { ScreenRect } from "./screenLayout";
import type { createTouchButton } from "./touchButton";
import { paintUiRoundedRect, type UiRoundedRect } from "./uiRoundedRect";
import {
  buildEndlessModePanelUi,
  type EndlessListLayout,
  type EnemyRow,
} from "./endlessMode/EndlessModePanelBuild";
import { EndlessModePanelScroll } from "./endlessMode/EndlessModePanelScroll";
import {
  endlessPanelE2eScrollState,
  endlessPanelE2eTapTargets,
  type EndlessPanelScrollState,
} from "./endlessMode/EndlessModePanelE2E";
import {
  collectEndlessModeTouchDebugScreenRects,
  type EndlessModeTouchDebugInput,
} from "./endlessMode/EndlessModePanelTouchDebug";

/**
 * Town overlay: multi-select foes, per-type concurrent caps, then start endless defense.
 * UI build, list scrolling and e2e helpers live in `ui/endlessMode/`.
 */
export class EndlessModePanel {
  private readonly store: DataStore;
  private readonly root: Phaser.GameObjects.Container;
  private readonly rows: EnemyRow[];
  private readonly layout: EndlessListLayout;
  private readonly selectedIds = new Set<string>();
  private readonly caps = new Map<string, number>();
  private startBtn: ReturnType<typeof createTouchButton> | null = null;
  private closeBtn: ReturnType<typeof createTouchButton> | null = null;
  private challengeRatingText!: Phaser.GameObjects.Text;
  private readonly onStart: (
    selections: EndlessRunSelection[],
    infiniteHp: boolean,
  ) => void;
  private readonly onDismiss: (() => void) | undefined;
  private readonly modalLease: ModalInputLease;
  private tornDown = false;
  private infiniteHp = true;
  private infiniteHpBg!: UiRoundedRect;
  private infiniteHpCheck!: Phaser.GameObjects.Text;
  private infiniteHpRowY = 0;
  private readonly challengeRatingY: number;
  private readonly startButtonY: number;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly scroll: EndlessModePanelScroll;
  private readonly listViewport: Phaser.GameObjects.Rectangle;
  private readonly scrollTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollThumb: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    store: DataStore,
    onStart: (selections: EndlessRunSelection[], infiniteHp: boolean) => void,
    onDismiss?: () => void,
  ) {
    this.store = store;
    this.onStart = onStart;
    this.onDismiss = onDismiss;

    const enemyIds = listPlayableDefenseEnemyIds(store);
    if (enemyIds.length === 0) enemyIds.push("grunt");

    const scroll = new EndlessModePanelScroll(scene, (id) => this.toggleSelect(id));
    this.scroll = scroll;
    const ui = buildEndlessModePanelUi(scene, store, enemyIds, this.caps, {
      listViewportHitForScroll: (x, y) => scroll.listViewportHitForScroll(x, y),
      listViewportPointerToScreen: (viewport, lx, ly) =>
        scroll.listViewportPointerToScreen(viewport, lx, ly),
      rowNameHitTest: (row) => scroll.rowNameHitTest(row),
      rowCapHitTest: (row) => scroll.rowCapHitTest(row),
      onBumpCap: (enemyId, delta) => this.bumpCap(enemyId, delta),
      onRowPointerDown: (pointer, enemyId) => scroll.beginDrag(pointer, "row", enemyId),
      onCapPointerDown: (pointer) => scroll.beginDrag(pointer, "cap"),
      onViewportPointerDown: (pointer) => scroll.beginDrag(pointer, "viewport"),
      onToggleInfiniteHp: () => this.toggleInfiniteHp(),
      onStartPressed: () => {
        const selections = this.buildSelections();
        if (selections.length === 0) return;
        this.onStart(selections, this.infiniteHp);
        this.destroy();
      },
      onClosePressed: () => this.destroy(),
    });
    this.root = ui.root;
    this.modalLease = ui.modalLease;
    this.rows = ui.rows;
    this.layout = ui.layout;
    this.maskGraphics = ui.maskGraphics;
    this.infiniteHpRowY = ui.infiniteHpRowY;
    this.infiniteHpBg = ui.infiniteHpBg;
    this.infiniteHpCheck = ui.infiniteHpCheck;
    this.challengeRatingY = ui.challengeRatingY;
    this.challengeRatingText = ui.challengeRatingText;
    this.startButtonY = ui.startButtonY;
    this.startBtn = ui.startBtn;
    this.closeBtn = ui.closeBtn;
    this.listViewport = ui.listViewport;
    this.scrollTrack = ui.scrollTrack;
    this.scrollThumb = ui.scrollThumb;
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
    this.refreshInfiniteHpVisuals();
    scroll.applyScroll(0);
    scroll.bindWheel();
  }

  private bumpCap(enemyId: string, delta: number): void {
    const cur = this.caps.get(enemyId) ?? ENDLESS_CONCURRENT_MIN;
    const next = clampEndlessConcurrent(cur + delta);
    this.caps.set(enemyId, next);
    const row = this.rows.find((r) => r.enemyId === enemyId);
    row?.capValue.setText(`${next}`);
    this.refreshChallengeRating();
  }

  private refreshChallengeRating(): void {
    const rows = this.buildSelections().map((s) => ({
      enemyId: s.enemyId,
      count: s.concurrentCap,
    }));
    const total = sumChallengeRating(this.store, rows);
    this.challengeRatingText.setText(`Challenge rating: ${total}`);
  }

  private buildSelections(): EndlessRunSelection[] {
    return [...this.selectedIds].map((enemyId) => ({
      enemyId,
      concurrentCap: this.caps.get(enemyId) ?? ENDLESS_CONCURRENT_MIN,
    }));
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
      row.capBg.setStrokeStyle(2, on ? 0x52525b : 0x3f3f46);
      row.capMinus.setAlpha(on ? 1 : 0.65);
      row.capPlus.setAlpha(on ? 1 : 0.65);
      row.capValue.setAlpha(on ? 1 : 0.65);
    }
  }

  private refreshStartButton(): void {
    setRosterStartEnabled(this.startBtn, this.selectedIds.size > 0);
  }

  private refreshInfiniteHpVisuals(): void {
    paintUiRoundedRect(
      this.infiniteHpBg,
      this.infiniteHp ? 0x1e3a5f : 0x27272a,
      this.infiniteHp ? 0x60a5fa : 0x52525b,
    );
    this.infiniteHpCheck.setText(this.infiniteHp ? "☑" : "☐");
    this.infiniteHpCheck.setColor(this.infiniteHp ? "#93c5fd" : "#a1a1aa");
  }

  private toggleInfiniteHp(): void {
    this.infiniteHp = !this.infiniteHp;
    this.refreshInfiniteHpVisuals();
  }

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.modalLease.release();
    this.scroll.destroy();
    if (this.maskGraphics.active) this.maskGraphics.destroy();
    if (this.startBtn?.container.active) this.startBtn.container.destroy();
    if (this.closeBtn?.container.active) this.closeBtn.container.destroy();
    if (this.root.active) this.root.destroy();
    this.onDismiss?.();
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

  touchDebugScreenRects(): ScreenRect[] {
    const input: EndlessModeTouchDebugInput = {
      layout: this.layout,
      scroll: this.scroll,
      rows: this.rows,
      listViewport: this.listViewport,
      scrollTrack: this.scrollTrack,
      scrollThumb: this.scrollThumb,
      infiniteHpBg: this.infiniteHpBg,
      startBtn: this.startBtn,
      closeBtn: this.closeBtn,
    };
    return collectEndlessModeTouchDebugScreenRects(input);
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    return endlessPanelE2eTapTargets({
      rows: this.rows,
      scroll: this.scroll,
      startBtn: this.startBtn,
      closeBtn: this.closeBtn,
      infiniteHpRowY: this.infiniteHpRowY,
      challengeRatingY: this.challengeRatingY,
    });
  }

  e2eFooterLayout(): {
    infiniteHpY: number;
    challengeRatingY: number;
    startY: number;
  } {
    return {
      infiniteHpY: this.infiniteHpRowY,
      challengeRatingY: this.challengeRatingY,
      startY: this.startButtonY,
    };
  }

  e2eInfiniteHpEnabled(): boolean {
    return this.infiniteHp;
  }

  e2eSetInfiniteHp(enabled: boolean): void {
    if (this.infiniteHp !== enabled) this.toggleInfiniteHp();
  }

  e2eScrollEnemyList(deltaY: number): void {
    this.scroll.applyScroll(this.scroll.scrollY + deltaY);
  }

  e2eEnemyListScrollState(): EndlessPanelScrollState {
    return endlessPanelE2eScrollState(this.scroll.scrollY, this.layout);
  }

  e2eStartWithEnemy(enemyId: string, infiniteHp = false): void {
    const defaultCap = clampEndlessConcurrent(
      this.store.player.endlessPanelDefaultConcurrent,
    );
    this.caps.set(enemyId, defaultCap);
    const row = this.rows.find((r) => r.enemyId === enemyId);
    row?.capValue.setText(`${defaultCap}`);
    this.selectedIds.clear();
    this.selectedIds.add(enemyId);
    this.refreshSelection();
    this.refreshChallengeRating();
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
