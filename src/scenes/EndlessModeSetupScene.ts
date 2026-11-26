import Phaser from "phaser";
import type { DataStore } from "../core/DataStore";
import {
  ensureTownReachableReady,
  isTownReachableReady,
} from "../core/GameAssetLoader";
import { showTouchInput } from "../debug/DebugState";
import { FpsDebugOverlay } from "../debug/FpsDebugOverlay";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { configureSceneInput } from "../input/inputTuning";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { EndlessModePanel } from "../ui/EndlessModePanel";
import { EndlessModePanelLoadingSkeleton } from "../ui/EndlessModePanelLoadingSkeleton";
import { collectInteractiveScreenRects } from "../debug/collectInteractiveScreenRects";
import { isPointerOverInteractive } from "./town/TownTouchDebug";
import {
  closeTownSetupScene,
  type EndlessModeSetupLaunchData,
  TOWN_ENDLESS_SETUP_SCENE_KEY,
} from "./town/townSetupSceneLifecycle";

export class EndlessModeSetupScene extends Phaser.Scene {
  private panel: EndlessModePanel | null = null;
  private loading: EndlessModePanelLoadingSkeleton | null = null;
  private touchDebug!: TouchInputDebugDraw;
  private fpsOverlay!: FpsDebugOverlay;
  private launchData!: EndlessModeSetupLaunchData;
  private started = false;

  constructor() {
    super({ key: TOWN_ENDLESS_SETUP_SCENE_KEY });
  }

  init(data: EndlessModeSetupLaunchData): void {
    this.launchData = data;
    this.started = false;
  }

  create(): void {
    configureSceneInput(this);
    this.touchDebug = new TouchInputDebugDraw(this);
    this.fpsOverlay = new FpsDebugOverlay(this);

    const store = this.registry.get("dataStore") as DataStore;
    const openPanel = (): void => {
      this.loading?.destroy();
      this.loading = null;
      if (this.panel) return;
      this.panel = new EndlessModePanel(
        this,
        store,
        (selections, infiniteHp) => {
          this.started = true;
          const launch = this.launchData;
          this.panel = null;
          closeTownSetupScene(this, () =>
            launch.onStart(selections, infiniteHp),
          );
        },
        () => {
          if (this.started) return;
          this.panel = null;
          closeTownSetupScene(this);
        },
      );
      if (isE2EEnabled()) {
        publishE2E({ scene: "Town", ready: true });
      }
    };

    if (isTownReachableReady(this.game, store)) {
      openPanel();
    } else {
      let cancelled = false;
      this.loading = new EndlessModePanelLoadingSkeleton(this, () => {
        cancelled = true;
        this.loading = null;
        closeTownSetupScene(this);
      });
      void ensureTownReachableReady(this, store)
        .then(() => {
          if (cancelled) return;
          openPanel();
        })
        .catch((err) => {
          console.error("Endless setup readiness failed", err);
          this.loading?.showError("Could not load endless roster. Try again.");
          this.time.delayedCall(2800, () => {
            this.loading?.destroy();
            this.loading = null;
            closeTownSetupScene(this);
          });
        });
    }

    this.events.on("shutdown", () => {
      this.loading?.destroy();
      this.loading = null;
      this.panel?.destroy();
      this.panel = null;
      this.touchDebug.destroy();
      this.fpsOverlay.destroy();
    });

    if (isE2EEnabled()) {
      publishE2E({ scene: "Town", ready: true });
    }
  }

  override update(_time: number, delta: number): void {
    this.fpsOverlay.tick(this.registry, delta, this.game);
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => isPointerOverInteractive(this, pointer),
      uiScreenRects: this.collectTouchDebugRects(),
    });
  }

  private collectTouchDebugRects() {
    const skip = [
      this.touchDebug.uiGraphics(),
      this.touchDebug.worldGraphics(),
    ];
    const base = collectInteractiveScreenRects(this, { skip });
    if (this.panel) {
      return [...base, ...this.panel.touchDebugScreenRects()];
    }
    return base;
  }

  e2eGetUiTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    if (this.loading) {
      Object.assign(out, this.loading.e2eTapTargets());
    }
    if (this.panel) {
      Object.assign(out, this.panel.e2eTapTargets());
    }
    return out;
  }

  e2eIsOpen(): boolean {
    return this.panel !== null;
  }

  e2eIsLoading(): boolean {
    return this.loading !== null;
  }

  e2eDismiss(): void {
    this.panel?.destroy();
    this.loading?.destroy();
  }

  e2eStartEndless(enemyId: string, infiniteHp = false): void {
    this.panel?.e2eStartWithEnemy(enemyId, infiniteHp);
  }

  e2eEndlessInfiniteHpEnabled(): boolean {
    return this.panel?.e2eInfiniteHpEnabled() ?? false;
  }

  e2eSetEndlessInfiniteHp(enabled: boolean): void {
    this.panel?.e2eSetInfiniteHp(enabled);
  }

  e2eScrollEndlessEnemyList(deltaY: number): void {
    this.panel?.e2eScrollEnemyList(deltaY);
  }

  e2eEndlessEnemyListScrollState(): ReturnType<
    EndlessModePanel["e2eEnemyListScrollState"]
  > | null {
    return this.panel?.e2eEnemyListScrollState() ?? null;
  }

  e2eEndlessSelectedEnemyId(): string | null {
    return this.panel?.e2eSelectedEnemyId() ?? null;
  }

  e2eEndlessSelectedEnemyIds(): string[] {
    return this.panel?.e2eSelectedEnemyIds() ?? [];
  }

  e2eEndlessRosterEnemyIds(): string[] {
    return this.panel?.e2eRosterEnemyIds() ?? [];
  }

  e2eEndlessEnemyConcurrentCap(enemyId: string): number | null {
    return this.panel?.e2eEnemyConcurrentCap(enemyId) ?? null;
  }

  e2eToggleEndlessEnemy(enemyId: string): void {
    this.panel?.e2eToggleEnemy(enemyId);
  }

  e2eSetEndlessEnemyCap(enemyId: string, cap: number): void {
    this.panel?.e2eSetEnemyCap(enemyId, cap);
  }

  e2eTouchDebugRectCount(): number {
    return this.collectTouchDebugRects().length;
  }
}
