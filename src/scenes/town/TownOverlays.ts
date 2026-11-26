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
import { SpellBarSortPanel } from "../../ui/SpellBarSortPanel";
import { TownDefenseLoadingOverlay } from "../../ui/TownDefenseLoadingOverlay";
import { getGearCatalog } from "../../gear/gearCatalog";
import { getLootConfig } from "../../gear/loot";
import { createRng, randomSeed } from "../../gear/rng";
import {
  defaultShopContext,
  ensureShopStock,
  type ShopId,
} from "../../gear/shops";
import { GearPanel } from "../../ui/GearPanel";
import type { GearPanelContext } from "../../ui/gearPanel/gearPanelLogic";
import { SaveMenuPanel } from "../../ui/SaveMenuPanel";
import { TalentPanel } from "../../ui/TalentPanel";
import type { ScreenRect } from "../../ui/screenLayout";
import {
  isEndlessModeSetupActive,
  isWavePlannerSetupActive,
  openEndlessModeSetupScene,
  openWavePlannerSetupScene,
} from "./townSetupSceneLifecycle";

/** Scene callbacks the Town overlays need (save access + run launch). */
export type TownOverlaysHost = {
  getSave(): SaveGame;
  /** Persist the sorted spell bar (called before the panel reference clears). */
  onSpellBarSorted(result: SaveGame["spellBar"]): void;
  onStartEndless(selections: EndlessRunSelection[], infiniteHp: boolean): void;
  onStartWavePlanner(groups: WaveGroup[]): void;
  /** Persist the slot and restart Town with the loaded save. */
  onLoadSaveSlot(save: SaveGame): void;
  /** Persist gear / gold / talent changes from the Gear and Talents panels. */
  onGearChanged(save: SaveGame): void;
};

/**
 * Town modal overlays: spell bar sort, save menu, debug launch, defense loading.
 * Endless roster and wave planner run on dedicated setup scenes (Town paused).
 */
export class TownOverlays {
  spellSortPanel: SpellBarSortPanel | null = null;
  saveMenuPanel: SaveMenuPanel | null = null;
  gearPanel: GearPanel | null = null;
  talentPanel: TalentPanel | null = null;
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
    if (isWavePlannerSetupActive(this.scene.game)) return;
    openWavePlannerSetupScene(this.scene, {
      onStart: (groups) => this.host.onStartWavePlanner(groups),
    });
  }

  openSaveMenuPanel(): void {
    if (this.saveMenuPanel) return;
    this.saveMenuPanel = new SaveMenuPanel(
      this.scene,
      () => this.host.getSave(),
      (save) => {
        this.saveMenuPanel = null;
        this.host.onLoadSaveSlot(save);
      },
      () => {
        this.saveMenuPanel = null;
      },
    );
  }

  /** Gear panel, or a shop (trader / blacksmith) with Shop + Bag tabs. */
  openGearPanel(shop?: ShopId): void {
    if (this.gearPanel) return;
    const catalog = getGearCatalog();
    const ctx: GearPanelContext = { catalog, loot: getLootConfig() };
    if (shop) {
      const store = this.scene.registry.get("dataStore") as DataStore;
      const rng = createRng(randomSeed());
      ctx.shop = {
        id: shop,
        ctx: defaultShopContext(catalog),
        buildings: store.buildings,
        rng,
      };
      const before = this.host.getSave();
      const stocked = ensureShopStock(before, ctx.shop.ctx, rng);
      if (stocked !== before) this.host.onGearChanged(stocked);
    }
    this.gearPanel = new GearPanel(
      this.scene,
      () => this.host.getSave(),
      (save) => this.host.onGearChanged(save),
      () => {
        this.gearPanel = null;
      },
      ctx,
    );
  }

  /** Talent tree; learn / reset persist through `onGearChanged` (stats re-apply). */
  openTalentPanel(): void {
    if (this.talentPanel) return;
    this.talentPanel = new TalentPanel(
      this.scene,
      () => this.host.getSave(),
      (save) => this.host.onGearChanged(save),
      () => {
        this.talentPanel = null;
      },
    );
  }

  openEndlessPanel(): void {
    if (isEndlessModeSetupActive(this.scene.game)) return;
    openEndlessModeSetupScene(this.scene, {
      onStart: (selections, infiniteHp) =>
        this.host.onStartEndless(selections, infiniteHp),
    });
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
    this.gearPanel?.destroy();
    this.gearPanel = null;
    this.talentPanel?.destroy();
    this.talentPanel = null;
    this.saveMenuPanel?.destroy();
    this.saveMenuPanel = null;
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

  /** Layout-derived touch-debug outlines for open town modals on this scene. */
  collectTouchDebugScreenRects(): ScreenRect[] {
    return [];
  }

  /** Merge open overlay e2e tap targets into `out` (same order as before the split). */
  collectE2eTapTargets(out: Record<string, { x: number; y: number }>): void {
    if (this.spellSortPanel) {
      Object.assign(out, this.spellSortPanel.e2eTapTargets());
    }
    if (this.saveMenuPanel) {
      Object.assign(out, this.saveMenuPanel.e2eTapTargets());
    }
    if (this.gearPanel) {
      Object.assign(out, this.gearPanel.e2eTapTargets());
    }
    if (this.talentPanel) {
      Object.assign(out, this.talentPanel.e2eTapTargets());
    }
  }
}
