import Phaser from "phaser";
import {
  getEmbeddedBuildId,
  townBuildIdLine,
} from "../buildId";
import { GAME } from "../config";
import type { SaveGame } from "../core/saveTypes";
import { DataStore } from "../core/DataStore";
import {
  playerDamageMult,
  persistSave,
  prepareDefenseNight,
  resetSaveAndReload,
} from "../core/GameState";
import { showTouchInput } from "../debug/DebugState";
import {
  DEBUG_MENU_CLOSE,
  launchDebugMenuFromHost,
  resumeFromDebugMenu,
} from "../debug/debugMenuLifecycle";
import { collectInteractiveScreenRects } from "../debug/collectInteractiveScreenRects";
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
import {
  createTouchButton,
  isTouchButtonVisuallyPressed,
} from "../ui/touchButton";
import {
  debugButtonPosition,
  readSafeInsets,
  townFullscreenButtonPosition,
  townResetSaveButtonPosition,
  townStatusTextTopY,
  townTitleY,
} from "../ui/screenLayout";
import { scaleUiX } from "../core/displayScale";
import { uiTextStyle } from "../ui/uiTextStyle";
import {
  fullscreenButtonLabel,
  toggleFullscreen,
} from "../ui/fullscreen";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { SpellBarSortPanel } from "../ui/SpellBarSortPanel";
import { EndlessModePanel } from "../ui/EndlessModePanel";
import { EndlessModePanelLoadingSkeleton } from "../ui/EndlessModePanelLoadingSkeleton";
import { WavePlannerPanel } from "../ui/WavePlannerPanel";
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
import {
  ensureNightReady,
  ensureTownReachableReady,
  isTownReachableReady,
} from "../core/GameAssetLoader";
import { TownDefenseLoadingOverlay } from "../ui/TownDefenseLoadingOverlay";
import { markE2EAssetsLoaded } from "../e2e/installE2E";

export class TownScene extends Phaser.Scene {
  private save!: SaveGame;
  private statusText!: Phaser.GameObjects.Text;
  private resetArmed = false;
  private resetButton!: ReturnType<typeof createTouchButton>;
  private debugButton!: ReturnType<typeof createTouchButton>;
  private fullscreenButton!: ReturnType<typeof createTouchButton>;
  private buildingControls = new Map<string, TownBuildingControl>();
  private statusFlashEvent: Phaser.Time.TimerEvent | null = null;
  private touchDebug!: TouchInputDebugDraw;
  private spellSortPanel: SpellBarSortPanel | null = null;
  private endlessPanel: EndlessModePanel | null = null;
  private endlessPanelLoading: EndlessModePanelLoadingSkeleton | null = null;
  private wavePlannerPanel: WavePlannerPanel | null = null;
  private defenseLoadingOverlay: TownDefenseLoadingOverlay | null = null;
  private readonly onInputModalityChanged = (): void => this.syncTownBaseInput();
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

    this.add
      .rectangle(0, 0, GAME.width, GAME.height, 0x1a1c24)
      .setOrigin(0);

    const titleY = townTitleY();
    this.add
      .text(
        GAME.width / 2,
        titleY,
        "Town — Day",
        uiTextStyle(this, {
          fontSize: `${scaleUiX(28)}px`,
          color: "#f4f4f5",
        }),
      )
      .setOrigin(0.5);

    this.statusText = this.add
      .text(
        GAME.width / 2,
        townStatusTextTopY(),
        "",
        uiTextStyle(this, {
          fontSize: `${scaleUiX(18)}px`,
          color: "#a1a1aa",
          align: "center",
          wordWrap: { width: GAME.width - scaleUiX(48) },
        }),
      )
      .setOrigin(0.5, 0);

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
        onTap: (buildingId, def) => this.onTownBuildingTap(store, buildingId, def),
      },
    );
    for (const c of controls) {
      this.buildingControls.set(c.buildingId, c);
    }

    const safe = readSafeInsets();
    const dbgPos = debugButtonPosition(this, safe);
    this.debugButton = createTouchButton(
      this,
      dbgPos.x,
      dbgPos.y,
      "Debug",
      () => {
        this.launchDebugMenuFromTown();
      },
      {
        width: scaleUiX(88),
        height: scaleUiX(36),
        depth: 200,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x3f3f46,
        strokeColor: 0xa1a1aa,
      },
    );

    const fsWidth = scaleUiX(168);
    const fsHeight = scaleUiX(36);
    const fsPos = townFullscreenButtonPosition(this, safe, fsWidth, fsHeight);
    const fsLabel = fullscreenButtonLabel(this.scale);
    this.fullscreenButton = createTouchButton(
      this,
      fsPos.x,
      fsPos.y,
      fsLabel,
      () => toggleFullscreen(this.scale),
      {
        width: fsWidth,
        height: fsHeight,
        depth: 200,
        fontSize: `${scaleUiX(13)}px`,
        fillColor: 0x1e3a5f,
        strokeColor: 0x60a5fa,
        activateOn: "pointerup",
      },
    );

    const resetWidth = scaleUiX(118);
    const resetHeight = scaleUiX(36);
    const resetPos = townResetSaveButtonPosition(this, safe, resetWidth, resetHeight);
    this.resetButton = createTouchButton(
      this,
      resetPos.x,
      resetPos.y,
      "Reset save",
      () => this.onResetTap(),
      {
        width: resetWidth,
        height: resetHeight,
        depth: 200,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x7f1d1d,
        strokeColor: 0xf87171,
      },
    );

    this.touchDebug = new TouchInputDebugDraw(this);
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
      this.teardownTownOverlays();
      this.buildingControls.clear();
      this.touchDebug.destroy();
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
    this.transitionToDefense(() => this.beginDefenseNight());
  }

  e2eGetUiTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const store = this.registry.get("dataStore") as DataStore;
    for (const [id, control] of this.buildingControls) {
      const pt = control.spriteCenter();
      out[`town-building-${id}`] = pt;
      const def = store.townBuildings[id];
      if (def?.startsNight) {
        out["start-night"] = pt;
      }
    }
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
    return out;
  }

  e2eGetSpellSortSlotHitRects(): ReturnType<SpellBarSortPanel["e2eSlotHitRects"]> {
    return this.spellSortPanel?.e2eSlotHitRects() ?? [];
  }

  e2eGetSpellSortBarSlots(): string[] {
    return this.spellSortPanel?.e2eBarSlots() ?? [];
  }

  e2eTownBuildingDebugRectCount(): number {
    return this.e2eTownTouchDebugRectCount();
  }

  e2eTownTouchDebugRectCount(): number {
    return this.collectTouchDebugUiRects().length;
  }

  e2eIsTouchButtonPressed(testId: string): boolean {
    if (testId === "start-night") {
      const btn = this.buildingControls.get("town_special_gallows_square");
      return btn
        ? isTouchButtonVisuallyPressed(btn.container)
        : false;
    }
    return false;
  }

  e2eOpenSpellSortPanel(): void {
    this.save = this.registry.get("save") as SaveGame;
    this.openSpellSortPanel();
  }

  e2eIsSpellSortPanelOpen(): boolean {
    return this.spellSortPanel !== null;
  }

  e2eOpenEndlessPanel(): void {
    this.openEndlessPanel();
  }

  e2eIsEndlessPanelOpen(): boolean {
    return this.endlessPanel !== null;
  }

  e2eIsEndlessPanelLoading(): boolean {
    return this.endlessPanelLoading !== null;
  }

  e2eStartEndless(enemyId: string, infiniteHp = false): void {
    const store = this.registry.get("dataStore") as DataStore;
    const cap = clampEndlessConcurrent(store.player.endlessPanelDefaultConcurrent);
    const selections: EndlessRunSelection[] = [
      { enemyId, concurrentCap: cap },
    ];
    this.endlessPanel?.destroy();
    this.endlessPanel = null;
    this.transitionToDefense(() =>
      this.beginEndlessDefense(selections, infiniteHp),
    );
  }

  e2eEndlessInfiniteHpEnabled(): boolean {
    return this.endlessPanel?.e2eInfiniteHpEnabled() ?? false;
  }

  e2eSetEndlessInfiniteHp(enabled: boolean): void {
    this.endlessPanel?.e2eSetInfiniteHp(enabled);
  }

  e2eScrollEndlessEnemyList(deltaY: number): void {
    this.endlessPanel?.e2eScrollEnemyList(deltaY);
  }

  e2eEndlessEnemyListScrollState(): ReturnType<
    EndlessModePanel["e2eEnemyListScrollState"]
  > | null {
    return this.endlessPanel?.e2eEnemyListScrollState() ?? null;
  }

  e2eEndlessSelectedEnemyId(): string | null {
    return this.endlessPanel?.e2eSelectedEnemyId() ?? null;
  }

  e2eEndlessSelectedEnemyIds(): string[] {
    return this.endlessPanel?.e2eSelectedEnemyIds() ?? [];
  }

  e2eEndlessRosterEnemyIds(): string[] {
    return this.endlessPanel?.e2eRosterEnemyIds() ?? [];
  }

  e2eEndlessEnemyConcurrentCap(enemyId: string): number | null {
    return this.endlessPanel?.e2eEnemyConcurrentCap(enemyId) ?? null;
  }

  e2eToggleEndlessEnemy(enemyId: string): void {
    this.endlessPanel?.e2eToggleEnemy(enemyId);
  }

  e2eSetEndlessEnemyCap(enemyId: string, cap: number): void {
    this.endlessPanel?.e2eSetEnemyCap(enemyId, cap);
  }

  private openSpellSortPanel(): void {
    if (this.spellSortPanel) return;
    const store = this.registry.get("dataStore") as DataStore;
    if (isTownReachableReady(this.game, store)) {
      this.createSpellSortPanel();
      return;
    }
    void ensureTownReachableReady(this, store).then(() => {
      if (this.spellSortPanel) return;
      this.createSpellSortPanel();
    });
  }

  private createSpellSortPanel(): void {
    this.spellSortPanel = new SpellBarSortPanel(
      this,
      this.save.spellBar.slots,
      this.save.spellBar.autoCastSpellIds,
      (result) => {
        this.save.spellBar = result;
        persistSave(this.save);
        this.registry.set("save", this.save);
        this.spellSortPanel = null;
      },
    );
  }

  private openWavePlannerPanel(): void {
    if (this.wavePlannerPanel) return;
    const store = this.registry.get("dataStore") as DataStore;
    const open = () => {
      if (this.wavePlannerPanel) return;
      this.wavePlannerPanel = new WavePlannerPanel(
      this,
      this.registry.get("dataStore") as DataStore,
      (groups) => {
        this.wavePlannerPanel = null;
        this.transitionToDefense(() => this.beginWavePlannerDefense(groups));
      },
      () => {
        this.wavePlannerPanel = null;
      },
      );
    };
    if (isTownReachableReady(this.game, store)) {
      open();
      return;
    }
    void ensureTownReachableReady(this, store).then(open);
  }

  private openEndlessPanel(): void {
    if (this.endlessPanel || this.endlessPanelLoading) return;
    const store = this.registry.get("dataStore") as DataStore;
    const open = () => {
      this.endlessPanelLoading?.destroy();
      this.endlessPanelLoading = null;
      if (this.endlessPanel) return;
      this.endlessPanel = new EndlessModePanel(
      this,
      store,
      (selections, infiniteHp) => {
        this.endlessPanel = null;
        this.transitionToDefense(() =>
          this.beginEndlessDefense(selections, infiniteHp),
        );
      },
      () => {
        this.endlessPanel = null;
      },
      );
    };
    if (isTownReachableReady(this.game, store)) {
      open();
      return;
    }
    let endlessOpenCancelled = false;
    const dismissLoading = (): void => {
      endlessOpenCancelled = true;
      this.endlessPanelLoading = null;
    };
    this.endlessPanelLoading = new EndlessModePanelLoadingSkeleton(this, dismissLoading);
    void ensureTownReachableReady(this, store)
      .then(() => {
        if (endlessOpenCancelled) return;
        open();
      })
      .catch((err) => {
        console.error("Endless panel readiness failed", err);
        this.endlessPanelLoading?.showError("Could not load endless roster. Try again.");
        this.time.delayedCall(2800, () => {
          this.endlessPanelLoading?.destroy();
          this.endlessPanelLoading = null;
        });
      });
  }

  private launchDebugMenuFromTown(): void {
    const store = this.registry.get("dataStore") as DataStore;
    const launch = () => launchDebugMenuFromHost(this);
    if (isTownReachableReady(this.game, store)) {
      launch();
      return;
    }
    void ensureTownReachableReady(this, store).then(launch);
  }

  private teardownTownOverlays(): void {
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

  /** Re-enable town layout + header chrome only when no modal owns input. */
  private syncTownBaseInput(): void {
    const enabled = !blocksBaseLayerInput(this);
    for (const control of this.buildingControls.values()) {
      control.setInputEnabled(enabled);
    }
    setContainerInputEnabled(this.resetButton.container, enabled);
    setContainerInputEnabled(this.debugButton.container, enabled);
    setContainerInputEnabled(this.fullscreenButton.container, enabled);
  }

  private transitionToDefense(run: () => void): void {
    const store = this.registry.get("dataStore") as DataStore;
    if (isTownReachableReady(this.game, store)) {
      run();
      return;
    }
    if (!this.defenseLoadingOverlay) {
      this.defenseLoadingOverlay = new TownDefenseLoadingOverlay(this);
    }
    void ensureNightReady(this, store)
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
        this.time.delayedCall(2800, () => {
          this.defenseLoadingOverlay?.destroy();
          this.defenseLoadingOverlay = null;
        });
      });
  }

  private beginDefenseNight(): void {
    this.save = prepareDefenseNight(this.save);
    persistSave(this.save);
    this.registry.set("save", this.save);
    setNightDefenseRun(this.registry);
    this.scene.start("Defense");
  }

  private beginEndlessDefense(
    selections: EndlessRunSelection[],
    infiniteHp: boolean,
  ): void {
    this.save = prepareDefenseNight(this.save);
    persistSave(this.save);
    this.registry.set("save", this.save);
    setEndlessDefenseRun(this.registry, selections, infiniteHp);
    this.scene.start("Defense");
  }

  private beginWavePlannerDefense(groups: WaveGroup[]): void {
    this.save = prepareDefenseNight(this.save);
    persistSave(this.save);
    this.registry.set("save", this.save);
    setWavePlannerDefenseRun(this.registry, groups);
    this.scene.start("Defense");
  }

  update(_time: number, _delta: number): void {
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => this.isPointerOverInteractive(pointer),
      uiScreenRects: this.collectTouchDebugUiRects(),
    });
  }

  private collectTouchDebugUiRects() {
    return collectInteractiveScreenRects(this, {
      skip: [this.touchDebug.uiGraphics(), this.touchDebug.worldGraphics()],
    });
  }

  private isPointerOverInteractive(pointer: Phaser.Input.Pointer): boolean {
    const hits = this.input.hitTestPointer(pointer);
    for (const hit of hits) {
      if (this.hasInteractiveInput(hit as Phaser.GameObjects.GameObject)) return true;
    }
    return false;
  }

  private hasInteractiveInput(obj: Phaser.GameObjects.GameObject): boolean {
    let node: Phaser.GameObjects.GameObject | null = obj;
    while (node) {
      if (node.input?.enabled) return true;
      const parent: Phaser.GameObjects.Container | null =
        (node as Phaser.GameObjects.GameObject & { parentContainer?: Phaser.GameObjects.Container })
          .parentContainer ?? null;
      node = parent;
    }
    return false;
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
      this.transitionToDefense(() => this.beginDefenseNight());
      return;
    }
    if (result.kind === "openSpellBar") {
      this.openSpellSortPanel();
      return;
    }
    if (result.kind === "openEndlessMode") {
      this.openEndlessPanel();
      return;
    }
    if (result.kind === "openWavePlanner") {
      this.openWavePlannerPanel();
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
    const wall = this.save.buildings.wall ?? 0;
    const smith = this.save.buildings.blacksmith ?? 0;
    const dmg = playerDamageMult(this.save.buildings).toFixed(2);
    const wallDef = store.buildings.wall;
    const wallCost =
      wall < (wallDef?.maxLevel ?? 0)
        ? wallDef?.costByLevel[wall]
        : undefined;
    const embedded = getEmbeddedBuildId();
    const urlB =
      typeof window !== "undefined"
        ? new URL(window.location.href).searchParams.get("b")
        : null;
    this.statusText.setText(
      [
        `Night ${this.save.night} · Gold ${this.save.gold}`,
        `Wall L${wall} (HP ${this.save.townWallHp}/${this.save.townWallHpMax})${wallCost !== undefined ? ` — next ${wallCost}g` : ""}`,
        `Blacksmith L${smith} (damage x${dmg})`,
        townBuildIdLine(embedded, urlB),
      ].join("\n"),
    );
  }
}