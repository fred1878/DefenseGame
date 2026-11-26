import Phaser from "phaser";
import type { SaveGame } from "../core/saveTypes";
import type { DataStore } from "../core/DataStore";
import {
  normalizeSave,
  persistSave,
  prepareDefenseNight,
  resetSaveAndReload,
} from "../core/GameState";
import { showTouchInput } from "../debug/DebugState";
import { applyGearLoadout } from "../gear/gearRuntime";
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
import type { createTouchButton } from "../ui/touchButton";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import type { SpellBarSortPanel } from "../ui/SpellBarSortPanel";
import { EndlessModeSetupScene } from "./EndlessModeSetupScene";
import { WavePlannerSetupScene } from "./WavePlannerSetupScene";
import { activeTownUiHost } from "../e2e/townUiHost";
import {
  setEndlessDefenseRun,
  setNightDefenseRun,
  setWavePlannerDefenseRun,
  type EndlessRunSelection,
} from "../core/defenseRunMode";
import type { WaveGroup } from "../core/DataStore";
import { createDefaultSpellBarAutoCast } from "../content/spells";
import { clampEndlessConcurrent } from "../systems/endlessSpawnScheduler";
import {
  spawnTownBuildingControls,
  type TownBuildingControl,
} from "../systems/TownBuildings";
import {
  formatTownBuildingButtonLabel,
  handleTownBuildingTap,
  townBuildingSubtitle,
} from "../systems/townBuildingMenu";
import { playCoinDeltaSfx } from "../audio/coinEconomySfx";
import { markBoot, measureBoot } from "../core/bootPerf";
import { ensureTownReachableReady } from "../core/GameAssetLoader";
import { markE2EAssetsLoaded } from "../e2e/installE2E";
import {
  createTownHeader,
  createTownHeaderButtons,
  formatTownStatus,
} from "./town/TownHeader";
import { TownOverlays } from "./town/TownOverlays";
import { dismissTownSetupScenes } from "./town/townSetupSceneLifecycle";
import {
  collectTownUiTapTargets,
  isTownTouchButtonPressed,
} from "./town/TownSceneE2E";
import {
  collectTownTouchDebugUiRects,
  isPointerOverInteractive,
} from "./town/TownTouchDebug";

export class TownScene extends Phaser.Scene {
  private save!: SaveGame;
  private statusText!: Phaser.GameObjects.Text;
  private resetArmed = false;
  private resetButton!: ReturnType<typeof createTouchButton>;
  private debugButton!: ReturnType<typeof createTouchButton>;
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
      this.registry.set("save", this.save);
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
    this.save = this.registry.get("save") as SaveGame;
    if (!this.save.spellBar.autoCastSpellIds) {
      this.save.spellBar.autoCastSpellIds = createDefaultSpellBarAutoCast();
    }
    const store = this.registry.get("dataStore") as DataStore;
    applyGearLoadout(this.save.gear);

    this.statusText = createTownHeader(this);
    this.refreshStatus(store);

    const controls = spawnTownBuildingControls(
      this,
      store.townBuildings,
      store.townLayout,
      {
        labelFor: (def) =>
          formatTownBuildingButtonLabel(
            def,
            townBuildingSubtitle(store, this.save, def),
          ),
        onTap: (buildingId, def) =>
          this.onTownBuildingTap(store, buildingId, def),
      },
    );
    for (const c of controls) {
      this.buildingControls.set(c.buildingId, c);
    }

    const buttons = createTownHeaderButtons(this, {
      onDebug: () => this.overlays.launchDebugMenu(),
      onReset: () => this.onResetTap(),
    });
    this.debugButton = buttons.debugButton;
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
      this.touchDebug.destroy();
      this.fpsOverlay.destroy();
    });

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
      .catch((err) => console.error("Town prefetch failed", err));

    if (isE2EEnabled()) {
      publishE2E({ scene: "Town", ready: true });
    }
  }

  e2eStartNight(): void {
    this.overlays.transitionToDefense(() => this.beginDefenseNight());
  }

  e2eGetUiTapTargets(): Record<string, { x: number; y: number }> {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      return host.e2eGetUiTapTargets();
    }
    if (host instanceof WavePlannerSetupScene) {
      return host.e2eGetUiTapTargets();
    }
    const store = this.registry.get("dataStore") as DataStore;
    return collectTownUiTapTargets(store, this.buildingControls, this.overlays);
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
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      return host.e2eTouchDebugRectCount();
    }
    if (host instanceof WavePlannerSetupScene) {
      return host.e2eTouchDebugRectCount();
    }
    return collectTownTouchDebugUiRects(this, this.touchDebug, this.overlays)
      .length;
  }

  e2eIsTouchButtonPressed(testId: string): boolean {
    return isTownTouchButtonPressed(this.buildingControls, testId);
  }

  e2eOpenSpellSortPanel(): void {
    this.save = this.registry.get("save") as SaveGame;
    this.overlays.openSpellSortPanel();
  }

  e2eIsSpellSortPanelOpen(): boolean {
    return this.overlays.spellSortPanel !== null;
  }

  e2eOpenEndlessPanel(): void {
    this.overlays.openEndlessPanel();
  }

  e2eIsEndlessPanelOpen(): boolean {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) return host.e2eIsOpen();
    return false;
  }

  e2eIsEndlessPanelLoading(): boolean {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) return host.e2eIsLoading();
    return false;
  }

  e2eStartEndless(enemyId: string, infiniteHp = false): void {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      host.e2eStartEndless(enemyId, infiniteHp);
      return;
    }
    const store = this.registry.get("dataStore") as DataStore;
    const cap = clampEndlessConcurrent(
      store.player.endlessPanelDefaultConcurrent,
    );
    const selections: EndlessRunSelection[] = [{ enemyId, concurrentCap: cap }];
    this.overlays.transitionToDefense(() =>
      this.beginEndlessDefense(selections, infiniteHp),
    );
  }

  e2eEndlessInfiniteHpEnabled(): boolean {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      return host.e2eEndlessInfiniteHpEnabled();
    }
    return false;
  }

  e2eSetEndlessInfiniteHp(enabled: boolean): void {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      host.e2eSetEndlessInfiniteHp(enabled);
    }
  }

  e2eScrollEndlessEnemyList(deltaY: number): void {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      host.e2eScrollEndlessEnemyList(deltaY);
    }
  }

  e2eEndlessEnemyListScrollState(): ReturnType<
    EndlessModeSetupScene["e2eEndlessEnemyListScrollState"]
  > | null {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      return host.e2eEndlessEnemyListScrollState();
    }
    return null;
  }

  e2eEndlessSelectedEnemyId(): string | null {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      return host.e2eEndlessSelectedEnemyId();
    }
    return null;
  }

  e2eEndlessSelectedEnemyIds(): string[] {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      return host.e2eEndlessSelectedEnemyIds();
    }
    return [];
  }

  e2eEndlessRosterEnemyIds(): string[] {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      return host.e2eEndlessRosterEnemyIds();
    }
    return [];
  }

  e2eEndlessEnemyConcurrentCap(enemyId: string): number | null {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      return host.e2eEndlessEnemyConcurrentCap(enemyId);
    }
    return null;
  }

  e2eToggleEndlessEnemy(enemyId: string): void {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      host.e2eToggleEndlessEnemy(enemyId);
    }
  }

  e2eSetEndlessEnemyCap(enemyId: string, cap: number): void {
    const host = activeTownUiHost(this.game);
    if (host instanceof EndlessModeSetupScene) {
      host.e2eSetEndlessEnemyCap(enemyId, cap);
    }
  }

  /** Re-enable town layout + header chrome only when no modal owns input. */
  private syncTownBaseInput(): void {
    const enabled = !blocksBaseLayerInput(this);
    for (const control of this.buildingControls.values()) {
      control.setInputEnabled(enabled);
    }
    setContainerInputEnabled(this.resetButton.container, enabled);
    setContainerInputEnabled(this.debugButton.container, enabled);
    setContainerInputEnabled(this.fullscreenButton.container, enabled);
    if (this.updateButton) {
      setContainerInputEnabled(this.updateButton.container, enabled);
    }
  }

  /** Write the slot into the live autosave and restart Town on that state. */
  private applyLoadedSave(save: SaveGame): void {
    const next = normalizeSave(save);
    persistSave(next);
    this.registry.set("save", next);
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
    this.registry.set("save", this.save);
    setRunMode();
    this.scene.start("Defense");
  }

  override update(_time: number, delta: number): void {
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
      this.time.delayedCall(4000, () => {
        this.resetArmed = false;
        this.resetButton.setLabel("Reset save");
      });
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
    const { save, result } = handleTownBuildingTap(store, this.save, def);
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
    if (result.kind === "upgraded") {
      this.save = save;
      playCoinDeltaSfx(this, goldBefore, save.gold);
      persistSave(this.save);
      this.registry.set("save", this.save);
      this.refreshBuildingOverlays(store);
      this.refreshStatus(store);
    }
    this.flashTransientStatus(result.message, store);
  }

  private refreshBuildingOverlays(store: DataStore): void {
    for (const [id, control] of this.buildingControls) {
      const def = store.townBuildings[id];
      if (!def) continue;
      control.setLabel(
        formatTownBuildingButtonLabel(
          def,
          townBuildingSubtitle(store, this.save, def),
        ),
      );
    }
  }

  private flashTransientStatus(message: string, store: DataStore): void {
    this.statusText.setText(message);
    if (this.statusFlashEvent) {
      this.statusFlashEvent.remove(false);
    }
    this.statusFlashEvent = this.time.delayedCall(2200, () => {
      this.statusFlashEvent = null;
      this.refreshStatus(store);
    });
  }

  private refreshStatus(store: DataStore): void {
    this.statusText.setText(formatTownStatus(this.save, store));
  }
}
