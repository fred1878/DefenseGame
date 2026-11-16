import Phaser from "phaser";
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
  pauseForDebugMenu,
  resumeFromDebugMenu,
} from "../debug/debugMenuLifecycle";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { configureSceneInput } from "../input/inputTuning";
import {
  createTouchButton,
  isTouchButtonVisuallyPressed,
} from "../ui/touchButton";
import { debugButtonPosition, readSafeInsets } from "../ui/screenLayout";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { uiTextStyle } from "../ui/uiTextStyle";
import {
  fullscreenButtonLabel,
  toggleFullscreen,
} from "../ui/fullscreen";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { SpellBarSortPanel } from "../ui/SpellBarSortPanel";
import { EndlessModePanel } from "../ui/EndlessModePanel";
import {
  setEndlessDefenseRun,
  setNightDefenseRun,
} from "../core/defenseRunMode";
import { createDefaultSpellBarAutoCast } from "../content/spells";
import {
  spawnTownBuildingControls,
  type TownBuildingControl,
} from "../systems/TownBuildings";
import {
  formatTownBuildingButtonLabel,
  handleTownBuildingTap,
  townBuildingSubtitle,
} from "../systems/townBuildingMenu";

export class TownScene extends Phaser.Scene {
  private save!: SaveGame;
  private statusText!: Phaser.GameObjects.Text;
  private resetArmed = false;
  private resetButton!: ReturnType<typeof createTouchButton>;
  private buildingControls = new Map<string, TownBuildingControl>();
  private statusFlashEvent: Phaser.Time.TimerEvent | null = null;
  private touchDebug!: TouchInputDebugDraw;
  private spellSortPanel: SpellBarSortPanel | null = null;
  private endlessPanel: EndlessModePanel | null = null;
  private readonly onDebugMenuClose = (): void => resumeFromDebugMenu(this);

  constructor() {
    super({ key: "Town" });
  }

  create(): void {
    configureSceneInput(this);
    this.save = this.registry.get("save") as SaveGame;
    if (!this.save.spellBar.autoCast?.length) {
      this.save.spellBar.autoCast = createDefaultSpellBarAutoCast();
    }
    const store = this.registry.get("dataStore") as DataStore;

    this.add
      .rectangle(0, 0, GAME.width, GAME.height, 0x1a1c24)
      .setOrigin(0);

    const titleY = scaleUiY(72);
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
        scaleUiY(140),
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
    createTouchButton(
      this,
      dbgPos.x,
      dbgPos.y,
      "Debug",
      () => {
        pauseForDebugMenu(this);
        this.scene.launch("DebugMenu");
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

    const fsLabel = fullscreenButtonLabel(this.scale);
    createTouchButton(
      this,
      scaleUiX(94) + safe.left,
      scaleUiY(44) + safe.top,
      fsLabel,
      () => toggleFullscreen(this.scale),
      {
        width: scaleUiX(168),
        height: scaleUiX(36),
        depth: 200,
        fontSize: `${scaleUiX(13)}px`,
        fillColor: 0x1e3a5f,
        strokeColor: 0x60a5fa,
        activateOn: "pointerup",
      },
    );

    this.resetButton = createTouchButton(
      this,
      GAME.width - scaleUiX(70) - safe.right,
      scaleUiY(44) + safe.top,
      "Reset save",
      () => this.onResetTap(),
      {
        width: scaleUiX(118),
        height: scaleUiX(36),
        depth: 200,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x7f1d1d,
        strokeColor: 0xf87171,
      },
    );

    this.touchDebug = new TouchInputDebugDraw(this);
    this.game.events.on(DEBUG_MENU_CLOSE, this.onDebugMenuClose);
    this.events.on("shutdown", () => {
      this.game.events.off(DEBUG_MENU_CLOSE, this.onDebugMenuClose);
      this.touchDebug.destroy();
    });

    if (isE2EEnabled()) {
      publishE2E({ scene: "Town", ready: true });
    }
  }

  e2eStartNight(): void {
    this.beginDefenseNight();
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
    if (this.endlessPanel) {
      Object.assign(out, this.endlessPanel.e2eTapTargets());
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
    return this.townBuildingDebugRects().length;
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

  e2eStartEndless(enemyId: string): void {
    if (!this.endlessPanel) this.openEndlessPanel();
    this.endlessPanel?.e2eStartWithEnemy(enemyId);
    this.endlessPanel = null;
  }

  private openSpellSortPanel(): void {
    if (this.spellSortPanel) return;
    this.spellSortPanel = new SpellBarSortPanel(
      this,
      this.save.spellBar.slots,
      this.save.spellBar.autoCast,
      (result) => {
        this.save.spellBar = result;
        persistSave(this.save);
        this.registry.set("save", this.save);
        this.spellSortPanel = null;
      },
    );
  }

  private openEndlessPanel(): void {
    if (this.endlessPanel) return;
    const store = this.registry.get("dataStore") as DataStore;
    this.endlessPanel = new EndlessModePanel(this, store, (enemyId) => {
      this.endlessPanel = null;
      this.beginEndlessDefense(enemyId);
    });
  }

  private beginDefenseNight(): void {
    this.save = prepareDefenseNight(this.save);
    persistSave(this.save);
    this.registry.set("save", this.save);
    setNightDefenseRun(this.registry);
    this.scene.start("Defense");
  }

  private beginEndlessDefense(enemyId: string): void {
    this.save = prepareDefenseNight(this.save);
    persistSave(this.save);
    this.registry.set("save", this.save);
    setEndlessDefenseRun(this.registry, enemyId);
    this.scene.start("Defense");
  }

  update(_time: number, _delta: number): void {
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    const uiScreenRects = [...this.townBuildingDebugRects()];
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => this.isPointerOverInteractive(pointer),
      uiScreenRects,
    });
  }

  private townBuildingDebugRects(): {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (const control of this.buildingControls.values()) {
      const r = control.hitFootprintScreenRect();
      if (r && r.width > 0 && r.height > 0) rects.push(r);
    }
    return rects;
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
    const { save, result } = handleTownBuildingTap(store, this.save, def);
    if (result.kind === "startNight") {
      this.beginDefenseNight();
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
    if (result.kind === "upgraded") {
      this.save = save;
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
    this.statusText.setText(
      [
        `Night ${this.save.night} · Gold ${this.save.gold}`,
        `Wall L${wall} (HP ${this.save.townWallHp}/${this.save.townWallHpMax})${wallCost !== undefined ? ` — next ${wallCost}g` : ""}`,
        `Blacksmith L${smith} (damage x${dmg})`,
        "Reset save: fresh start + latest build",
      ].join("\n"),
    );
  }
}