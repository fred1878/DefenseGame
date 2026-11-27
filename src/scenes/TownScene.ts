import Phaser from "phaser";
import { tuning } from "../tuning/gameTuning";
import { reportFatal } from "../ui/panels/FatalErrorPanel";
import { debugEconomyPolicy } from "../debug/debugEconomy";
import { createDefaultAutoCastSpellIds } from "../content/spellBarAutoCast";
import type { SaveGame } from "../core/save/saveTypes";
import type { DataStore } from "../core/data/DataStore";
import {
  normalizeSave,
  prepareDefenseNight,
  syncPlayerHpMax,
} from "../core/save/GameState";
import { persistSave, resetSaveAndReload } from "../core/save/saveRepository";
import { showTouchInput } from "../debug/DebugState";
import { applySaveLoadout } from "../talents/talentRuntime";
import {
  DEBUG_MENU_CLOSE,
  resumeFromDebugMenu,
} from "../debug/debugMenuLifecycle";
import { FpsDebugOverlay } from "../debug/FpsDebugOverlay";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { configureSceneInput } from "../input/inputTuning";
import {
  blocksBaseLayerInput,
  clearInputModalities,
  INPUT_MODALITY,
  INPUT_MODALITY_CHANGED,
  popInputModality,
} from "../input/inputModality";
import { setContainerInputEnabled } from "../input/setContainerInputEnabled";
import type { createTouchButton } from "../ui/touch/touchButton";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import type { SpellBarSortPanel } from "../ui/panels/SpellBarSortPanel";
import {
  setEndlessDefenseRun,
  setNightDefenseRun,
  setWavePlannerDefenseRun,
  type EndlessRunSelection,
} from "../core/defenseRunMode";
import type { WaveGroup } from "../core/data/DataStore";
import {
  spawnTownBuildingControls,
  type TownBuildingControl,
} from "./town/TownBuildings";
import {
  handleTownBuildingTap,
  townBuildingPlateInfo,
} from "../systems/townBuildingMenu";
import type { TownBuildingDef } from "../core/data/townBuildingTypes";
import {
  townBuildingArtTier,
  townGrowthView,
  type TownGrowthView,
} from "../world/townIso/townGrowth";
import { TOWN_ISO_BUILDING_TIERS } from "../world/townIso/townIsoStageData";
import { TownIsoWorld } from "./town/TownIsoWorld";
import { playCoinDeltaSfx } from "../audio/coinEconomySfx";
import { playUiSfx } from "../audio/uiSfx";
import { markBoot, measureBoot } from "../core/bootPerf";
import { applyPixelRenderDebugSettings } from "../core/render/pixelRenderDebug";
import { ensureTownReachableReady } from "./loading/GameAssetLoader";
import { markE2EAssetsLoaded } from "../e2e/e2eAssets";
import {
  createTownHeader,
  createTownHeaderButtons,
  formatTownStatus,
  type TownHud,
} from "./town/TownHeader";
import { TownOverlays } from "./town/TownOverlays";
import { dismissTownSetupScenes } from "./town/townSetupSceneLifecycle";
import {
  collectTownUiTapTargets,
  isTownTouchButtonPressed,
  e2eEndlessSelections,
} from "./town/TownSceneE2E";
import { collectTownTouchDebugUiRects } from "./town/TownTouchDebug";
import { isPointerOverInteractive } from "../input/pointerOverInteractive";
import { getDataStore, getSave, setSave } from "../core/registryKeys";

export class TownScene extends Phaser.Scene {
  private save!: SaveGame;
  private statusText!: Phaser.GameObjects.Text;
  private hud!: TownHud;
  private world!: TownIsoWorld;
  private resetArmed = false;
  private resetButton!: ReturnType<typeof createTouchButton>;
  private debugButton!: ReturnType<typeof createTouchButton>;
  private gearButton!: ReturnType<typeof createTouchButton>;
  private talentsButton!: ReturnType<typeof createTouchButton>;
  private fullscreenButton!: ReturnType<typeof createTouchButton>;
  private updateButton: ReturnType<typeof createTouchButton> | undefined;
  private buildingControls = new Map<string, TownBuildingControl>();
  private statusFlashEvent: Phaser.Time.TimerEvent | null = null;
  private touchDebug!: TouchInputDebugDraw;
  private fpsOverlay!: FpsDebugOverlay;
  private readonly overlays = new TownOverlays(this, {
    getSave: () => this.save,
    onSpellBarSorted: (result) => {
      this.save.spellBar = result;
      persistSave(this.save);
      setSave(this.registry, this.save);
    },
    onStartEndless: (selections, infiniteHp) =>
      this.overlays.transitionToDefense(() =>
        this.beginEndlessDefense(selections, infiniteHp),
      ),
    onStartWavePlanner: (groups) =>
      this.overlays.transitionToDefense(() =>
        this.beginWavePlannerDefense(groups),
      ),
    onLoadSaveSlot: (save) => this.applyLoadedSave(save),
    onGearChanged: (save) => this.applyGearChange(save),
  });
  private readonly onInputModalityChanged = (): void =>
    this.syncTownBaseInput();
  private readonly onDebugMenuClose = (): void => {
    popInputModality(this, INPUT_MODALITY.debugMenu.id);
    resumeFromDebugMenu(this);
  };

  constructor() {
    super({ key: "Town" });
  }

  create(): void {
    configureSceneInput(this);
    applyPixelRenderDebugSettings(this.game);
    this.syncSaveFromRegistry();
    if (!this.save.spellBar.autoCastSpellIds) {
      this.save.spellBar.autoCastSpellIds = createDefaultAutoCastSpellIds();
    }
    const store = getDataStore(this.registry);
    applySaveLoadout(this.save);

    this.hud = createTownHeader(this);
    this.statusText = this.hud.statusText;
    this.world = new TownIsoWorld(this);
    const growth = townGrowthView(this.save.buildings);
    this.world.build(growth.stage, growth.nextStageTownLevel);

    const controls = spawnTownBuildingControls(
      this,
      store.townBuildings,
      store.townLayout,
      {
        viewFor: (buildingId, def) =>
          this.buildingView(store, buildingId, def, growth),
        onTap: (buildingId, def) =>
          this.onTownBuildingTap(store, buildingId, def),
      },
    );
    for (const c of controls) {
      this.buildingControls.set(c.buildingId, c);
    }
    this.refreshStatus(store);

    const buttons = createTownHeaderButtons(this, {
      onDebug: () => this.overlays.launchDebugMenu(),
      onGear: () => {
        this.syncSaveFromRegistry();
        this.overlays.openGearPanel();
      },
      onTalents: () => {
        this.syncSaveFromRegistry();
        this.overlays.openTalentPanel();
      },
      onReset: () => this.onResetTap(),
    });
    this.debugButton = buttons.debugButton;
    this.gearButton = buttons.gearButton;
    this.talentsButton = buttons.talentsButton;
    this.fullscreenButton = buttons.fullscreenButton;
    this.resetButton = buttons.resetButton;
    this.updateButton = buttons.updateButton;

    this.touchDebug = new TouchInputDebugDraw(this);
    this.fpsOverlay = new FpsDebugOverlay(this);
    this.events.on(INPUT_MODALITY_CHANGED, this.onInputModalityChanged);
    this.game.events.on(DEBUG_MENU_CLOSE, this.onDebugMenuClose);
    this.events.on("shutdown", () => {
      this.events.off(INPUT_MODALITY_CHANGED, this.onInputModalityChanged);
      this.game.events.off(DEBUG_MENU_CLOSE, this.onDebugMenuClose);
      clearInputModalities(this);
      if (this.statusFlashEvent) {
        this.statusFlashEvent.remove(false);
        this.statusFlashEvent = null;
      }
      this.overlays.teardown();
      this.buildingControls.clear();
      this.world.destroy();
      this.touchDebug.destroy();
      this.fpsOverlay.destroy();
    });

    this.startTownPrefetch(store);

    if (isE2EEnabled()) {
      publishE2E({ scene: "Town", ready: true });
    }
  }

  e2eStartNight(): void {
    this.overlays.transitionToDefense(() => this.beginDefenseNight());
  }

  e2eGetUiTapTargets(): Record<string, { x: number; y: number }> {
    return collectTownUiTapTargets(
      getDataStore(this.registry),
      this.buildingControls,
      this.overlays,
      blocksBaseLayerInput(this)
        ? []
        : [
            ["town-gear", this.gearButton.container],
            ["town-talents", this.talentsButton.container],
          ],
    );
  }

  e2eGetSpellSortSlotHitRects(): ReturnType<
    SpellBarSortPanel["e2eSlotHitRects"]
  > {
    return this.overlays.spellSortPanel?.e2eSlotHitRects() ?? [];
  }

  e2eGetSpellSortBarSlots(): string[] {
    return this.overlays.spellSortPanel?.e2eBarSlots() ?? [];
  }

  e2eTownBuildingDebugRectCount(): number {
    return this.e2eTownTouchDebugRectCount();
  }

  e2eTownTouchDebugRectCount(): number {
    return collectTownTouchDebugUiRects(this, this.touchDebug, this.overlays)
      .length;
  }

  e2eIsTouchButtonPressed(testId: string): boolean {
    return isTownTouchButtonPressed(this.buildingControls, testId);
  }

  e2eOpenSpellSortPanel(): void {
    this.syncSaveFromRegistry();
    this.overlays.openSpellSortPanel();
  }

  e2eIsSpellSortPanelOpen(): boolean {
    return this.overlays.spellSortPanel !== null;
  }

  e2eOpenEndlessPanel(): void {
    this.overlays.openEndlessPanel();
  }

  e2eStartEndless(enemyId: string, infiniteHp = false): void {
    const selections = e2eEndlessSelections(
      getDataStore(this.registry),
      enemyId,
    );
    this.overlays.transitionToDefense(() =>
      this.beginEndlessDefense(selections, infiniteHp),
    );
  }

  /** Background prefetch of everything reachable from Town; Retry panel on failure. */
  private startTownPrefetch(store: DataStore): void {
    markBoot("defensegame:town-prefetch-start");
    void ensureTownReachableReady(this, store)
      .then(() => {
        markBoot("defensegame:town-prefetch-end");
        measureBoot(
          "defensegame:town-prefetch",
          "defensegame:town-prefetch-start",
          "defensegame:town-prefetch-end",
        );
        if (isE2EEnabled()) {
          markE2EAssetsLoaded(this.game);
          publishE2E({ assetsLoaded: true });
        }
      })
      .catch((err) => {
        if (!this.scene.isActive()) return;
        reportFatal(this, {
          title: "Could not load town assets",
          message: "Check your connection and try again.",
          error: err,
          onRetry: () => this.startTownPrefetch(store),
        });
      });
  }

  /**
   * Re-read the live save from the registry (the source of truth). E2E `setSave`
   * and other scenes write the registry only, so panels reopen on the latest save.
   */
  private syncSaveFromRegistry(): void {
    this.save = getSave(this.registry);
  }

  /** Re-enable town layout + header chrome only when no modal owns input. */
  private syncTownBaseInput(): void {
    const enabled = !blocksBaseLayerInput(this);
    for (const control of this.buildingControls.values()) {
      control.setInputEnabled(enabled);
    }
    setContainerInputEnabled(this.resetButton.container, enabled);
    setContainerInputEnabled(this.debugButton.container, enabled);
    setContainerInputEnabled(this.gearButton.container, enabled);
    setContainerInputEnabled(this.talentsButton.container, enabled);
    setContainerInputEnabled(this.fullscreenButton.container, enabled);
    if (this.updateButton) {
      setContainerInputEnabled(this.updateButton.container, enabled);
    }
  }

  /** Gear / talent changes: persist, re-apply gear + talent stats and refresh the header. */
  private applyGearChange(save: SaveGame): void {
    this.save = syncPlayerHpMax(save);
    persistSave(this.save);
    setSave(this.registry, this.save);
    applySaveLoadout(this.save);
    this.refreshStatus(getDataStore(this.registry));
  }

  /** Write the slot into the live autosave and restart Town on that state. */
  private applyLoadedSave(save: SaveGame): void {
    const next = normalizeSave(save);
    persistSave(next);
    setSave(this.registry, next);
    this.time.delayedCall(0, () => this.scene.restart());
  }

  private beginDefenseNight(): void {
    this.beginDefenseRun(() => setNightDefenseRun(this.registry));
  }

  private beginEndlessDefense(
    selections: EndlessRunSelection[],
    infiniteHp: boolean,
  ): void {
    this.beginDefenseRun(() =>
      setEndlessDefenseRun(this.registry, selections, infiniteHp),
    );
  }

  private beginWavePlannerDefense(groups: WaveGroup[]): void {
    this.beginDefenseRun(() => setWavePlannerDefenseRun(this.registry, groups));
  }

  /** Prepare + persist the night save, set the run mode, start Defense. */
  private beginDefenseRun(setRunMode: () => void): void {
    dismissTownSetupScenes(this.game);
    this.save = prepareDefenseNight(this.save);
    persistSave(this.save);
    setSave(this.registry, this.save);
    setRunMode();
    this.scene.start("Defense");
  }

  override update(_time: number, delta: number): void {
    this.world.tick(delta);
    this.fpsOverlay.tick(this.registry, delta, this.game);
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => isPointerOverInteractive(this, pointer),
      uiScreenRects: collectTownTouchDebugUiRects(
        this,
        this.touchDebug,
        this.overlays,
      ),
    });
  }

  private onResetTap(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetButton.setLabel("Confirm reset");
      this.time.delayedCall(
        tuning("gameplay").feel.resetConfirmWindowMs,
        () => {
          this.resetArmed = false;
          this.resetButton.setLabel("Reset save");
        },
      );
      return;
    }
    resetSaveAndReload();
  }

  private onTownBuildingTap(
    store: DataStore,
    _buildingId: string,
    def: (typeof store.townBuildings)[string],
  ): void {
    if (blocksBaseLayerInput(this)) return;
    const goldBefore = this.save.gold;
    const { save, result } = handleTownBuildingTap(
      store,
      this.save,
      def,
      debugEconomyPolicy(this.registry),
    );
    if (result.kind === "startNight") {
      this.overlays.transitionToDefense(() => this.beginDefenseNight());
      return;
    }
    if (result.kind === "openSpellBar") {
      this.overlays.openSpellSortPanel();
      return;
    }
    if (result.kind === "openEndlessMode") {
      this.overlays.openEndlessPanel();
      return;
    }
    if (result.kind === "openWavePlanner") {
      this.overlays.openWavePlannerPanel();
      return;
    }
    if (result.kind === "openSaveMenu") {
      this.overlays.openSaveMenuPanel();
      return;
    }
    if (result.kind === "openShop") {
      this.syncSaveFromRegistry();
      this.overlays.openGearPanel(result.shop);
      return;
    }
    if (result.kind === "upgraded") {
      this.save = save;
      playCoinDeltaSfx(this, goldBefore, save.gold);
      playUiSfx(this, "upgrade");
      persistSave(this.save);
      setSave(this.registry, this.save);
      this.refreshStatus(store);
    }
    this.flashTransientStatus(result.message, store);
  }

  /** Art tier + name plate for one building at the current town growth. */
  private buildingView(
    store: DataStore,
    buildingId: string,
    def: TownBuildingDef,
    growth: TownGrowthView,
  ) {
    const tiers = TOWN_ISO_BUILDING_TIERS[buildingId] ?? [];
    const idx = townBuildingArtTier(def, this.save.buildings, growth.stage);
    const tier = tiers[idx] ?? tiers[tiers.length - 1];
    if (!tier) throw new Error(`No isometric art for ${buildingId}`);
    return {
      tier,
      plate: townBuildingPlateInfo(
        store,
        this.save,
        def,
        debugEconomyPolicy(this.registry),
      ),
    };
  }

  /** Town growth (stage scenery), building tiers and plates from the current save. */
  private refreshBuildingOverlays(store: DataStore): void {
    const growth = townGrowthView(this.save.buildings);
    this.world.build(growth.stage, growth.nextStageTownLevel);
    for (const [id, control] of this.buildingControls) {
      const def = store.townBuildings[id];
      if (!def) continue;
      control.update(this.buildingView(store, id, def, growth));
    }
    this.world.bake(
      [...this.buildingControls.values()].map((c) => c.bakeArt()),
    );
    this.hud.update(this.save, growth);
  }

  private flashTransientStatus(message: string, store: DataStore): void {
    this.statusText.setText(message);
    if (this.statusFlashEvent) {
      this.statusFlashEvent.remove(false);
    }
    this.statusFlashEvent = this.time.delayedCall(
      tuning("gameplay").feel.townStatusMs,
      () => {
        this.statusFlashEvent = null;
        this.refreshStatus(store);
      },
    );
  }

  private refreshStatus(store: DataStore): void {
    this.statusText.setText(formatTownStatus(this.save, store));
    this.refreshBuildingOverlays(store);
  }
}
