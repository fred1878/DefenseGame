import type Phaser from "phaser";
import type { DataStore, WaveGroup } from "../../core/DataStore";
import type { EndlessRunSelection } from "../../core/defenseRunMode";
import type { SaveGame } from "../../core/saveTypes";
import {
  ensureNightReady,
  ensureTownReachableReady,
  isTownReachableReady,
} from "../../core/GameAssetLoader";
import { launchDebugMenuFromHost } from "../../debug/debugMenuLifecycle";
import { EndlessModePanel } from "../../ui/EndlessModePanel";
import { EndlessModePanelLoadingSkeleton } from "../../ui/EndlessModePanelLoadingSkeleton";
import { SpellBarSortPanel } from "../../ui/SpellBarSortPanel";
import { TownDefenseLoadingOverlay } from "../../ui/TownDefenseLoadingOverlay";
import { WavePlannerPanel } from "../../ui/WavePlannerPanel";

/** Scene callbacks the Town overlays need (save access + run launch). */
export type TownOverlaysHost = {
  getSave(): SaveGame;
  /** Persist the sorted spell bar (called before the panel reference clears). */
  onSpellBarSorted(result: SaveGame["spellBar"]): void;
  onStartEndless(selections: EndlessRunSelection[], infiniteHp: boolean): void;
  onStartWavePlanner(groups: WaveGroup[]): void;
};

/**
 * Town modal overlays: spell bar sort, endless roster (+ loading skeleton),
 * wave planner, debug menu launch, and the defense loading overlay.
 */
export class TownOverlays {
  spellSortPanel: SpellBarSortPanel | null = null;
  endlessPanel: EndlessModePanel | null = null;
  endlessPanelLoading: EndlessModePanelLoadingSkeleton | null = null;
  wavePlannerPanel: WavePlannerPanel | null = null;
  private defenseLoadingOverlay: TownDefenseLoadingOverlay | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: TownOverlaysHost,
  ) {}

  openSpellSortPanel(): void {
    if (this.spellSortPanel) return;
    const store = this.scene.registry.get("dataStore") as DataStore;
    if (isTownReachableReady(this.scene.game, store)) {
      this.createSpellSortPanel();
      return;
    }
    void ensureTownReachableReady(this.scene, store).then(() => {
      if (this.spellSortPanel) return;
      this.createSpellSortPanel();
    });
  }

  private createSpellSortPanel(): void {
    const save = this.host.getSave();
    this.spellSortPanel = new SpellBarSortPanel(
      this.scene,
      save.spellBar.slots,
      save.spellBar.autoCastSpellIds,
      (result) => {
        this.host.onSpellBarSorted(result);
        this.spellSortPanel = null;
      },
    );
  }

  openWavePlannerPanel(): void {
    if (this.wavePlannerPanel) return;
    const store = this.scene.registry.get("dataStore") as DataStore;
    const open = () => {
      if (this.wavePlannerPanel) return;
      this.wavePlannerPanel = new WavePlannerPanel(
        this.scene,
        this.scene.registry.get("dataStore") as DataStore,
        (groups) => {
          this.wavePlannerPanel = null;
          this.host.onStartWavePlanner(groups);
        },
        () => {
          this.wavePlannerPanel = null;
        },
      );
    };
    if (isTownReachableReady(this.scene.game, store)) {
      open();
      return;
    }
    void ensureTownReachableReady(this.scene, store).then(open);
  }

  openEndlessPanel(): void {
    if (this.endlessPanel || this.endlessPanelLoading) return;
    const store = this.scene.registry.get("dataStore") as DataStore;
    const open = () => {
      this.endlessPanelLoading?.destroy();
      this.endlessPanelLoading = null;
      if (this.endlessPanel) return;
      this.endlessPanel = new EndlessModePanel(
        this.scene,
        store,
        (selections, infiniteHp) => {
          this.endlessPanel = null;
          this.host.onStartEndless(selections, infiniteHp);
        },
        () => {
          this.endlessPanel = null;
        },
      );
    };
    if (isTownReachableReady(this.scene.game, store)) {
      open();
      return;
    }
    let endlessOpenCancelled = false;
    const dismissLoading = (): void => {
      endlessOpenCancelled = true;
      this.endlessPanelLoading = null;
    };
    this.endlessPanelLoading = new EndlessModePanelLoadingSkeleton(
      this.scene,
      dismissLoading,
    );
    void ensureTownReachableReady(this.scene, store)
      .then(() => {
        if (endlessOpenCancelled) return;
        open();
      })
      .catch((err) => {
        console.error("Endless panel readiness failed", err);
        this.endlessPanelLoading?.showError("Could not load endless roster. Try again.");
        this.scene.time.delayedCall(2800, () => {
          this.endlessPanelLoading?.destroy();
          this.endlessPanelLoading = null;
        });
      });
  }

  /** Close the endless roster without starting (e2e start path). */
  dismissEndlessPanel(): void {
    this.endlessPanel?.destroy();
    this.endlessPanel = null;
  }

  launchDebugMenu(): void {
    const store = this.scene.registry.get("dataStore") as DataStore;
    const launch = () => launchDebugMenuFromHost(this.scene);
    if (isTownReachableReady(this.scene.game, store)) {
      launch();
      return;
    }
    void ensureTownReachableReady(this.scene, store).then(launch);
  }

  teardown(): void {
    this.endlessPanelLoading?.destroy();
    this.endlessPanelLoading = null;
    this.endlessPanel?.destroy();
    this.endlessPanel = null;
    this.wavePlannerPanel?.destroy();
    this.wavePlannerPanel = null;
    this.spellSortPanel?.destroy();
    this.spellSortPanel = null;
    this.defenseLoadingOverlay?.destroy();
    this.defenseLoadingOverlay = null;
  }

  /** Run `run` once night assets are ready, showing a loading overlay meanwhile. */
  transitionToDefense(run: () => void): void {
    const store = this.scene.registry.get("dataStore") as DataStore;
    if (isTownReachableReady(this.scene.game, store)) {
      run();
      return;
    }
    if (!this.defenseLoadingOverlay) {
      this.defenseLoadingOverlay = new TownDefenseLoadingOverlay(this.scene);
    }
    void ensureNightReady(this.scene, store)
      .then(() => {
        this.defenseLoadingOverlay?.destroy();
        this.defenseLoadingOverlay = null;
        run();
      })
      .catch((err) => {
        console.error("Night readiness failed", err);
        this.defenseLoadingOverlay?.showError(
          "Could not load defense. Try again.",
        );
        this.scene.time.delayedCall(2800, () => {
          this.defenseLoadingOverlay?.destroy();
          this.defenseLoadingOverlay = null;
        });
      });
  }

  /** Merge open overlay e2e tap targets into `out` (same order as before the split). */
  collectE2eTapTargets(out: Record<string, { x: number; y: number }>): void {
    if (this.spellSortPanel) {
      Object.assign(out, this.spellSortPanel.e2eTapTargets());
    }
    if (this.endlessPanelLoading) {
      Object.assign(out, this.endlessPanelLoading.e2eTapTargets());
    }
    if (this.endlessPanel) {
      Object.assign(out, this.endlessPanel.e2eTapTargets());
    }
    if (this.wavePlannerPanel) {
      Object.assign(out, this.wavePlannerPanel.e2eTapTargets());
    }
  }
}
