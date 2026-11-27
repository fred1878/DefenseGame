import type { DataStore } from "../core/data/DataStore";
import type { ScreenRect } from "../ui/layout/screenLayout";
import {
  ensureTownReachableReady,
  isTownReachableReady,
} from "./loading/GameAssetLoader";
import { EndlessModePanel } from "../ui/panels/EndlessModePanel";
import { EndlessModePanelLoadingSkeleton } from "../ui/panels/EndlessModePanelLoadingSkeleton";
import {
  closeTownSetupScene,
  type EndlessModeSetupLaunchData,
  TOWN_ENDLESS_SETUP_SCENE_KEY,
} from "./town/townSetupSceneLifecycle";
import { TownRosterSetupScene } from "./town/TownRosterSetupScene";
import { reportFatal } from "../ui/panels/FatalErrorPanel";

export class EndlessModeSetupScene extends TownRosterSetupScene<
  EndlessModePanel,
  EndlessModeSetupLaunchData
> {
  private loading: EndlessModePanelLoadingSkeleton | null = null;

  constructor() {
    super({ key: TOWN_ENDLESS_SETUP_SCENE_KEY });
  }

  protected openSetup(store: DataStore): void {
    const openPanel = (): void => {
      this.loading?.destroy();
      this.loading = null;
      this.showPanel(
        () =>
          new EndlessModePanel(
            this,
            store,
            (selections, infiniteHp) => {
              const launch = this.launchData;
              this.startRun(() => launch.onStart(selections, infiniteHp));
            },
            () => this.dismissPanel(),
          ),
      );
    };

    if (isTownReachableReady(this.game, store)) {
      openPanel();
      return;
    }
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
        if (cancelled) return;
        this.loading?.destroy();
        this.loading = null;
        reportFatal(this, {
          title: "Could not load endless roster",
          message: "Check your connection and try again.",
          error: err,
          onRetry: () => this.openSetup(store),
          onClose: () => closeTownSetupScene(this),
        });
      });
  }

  protected override onSetupShutdown(): void {
    this.loading?.destroy();
    this.loading = null;
  }

  protected override extraTouchDebugRects(): ScreenRect[] {
    return this.panel?.touchDebugScreenRects() ?? [];
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
    return this.panel !== null || this.loading !== null;
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
}
