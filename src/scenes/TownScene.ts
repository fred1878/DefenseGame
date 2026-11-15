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
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { configureSceneInput } from "../input/inputTuning";
import {
  createTouchButton,
  interactiveObjectScreenRect,
  isTouchButtonVisuallyPressed,
} from "../ui/touchButton";
import {
  debugButtonPosition,
  readSafeInsets,
  townActionButtonY,
} from "../ui/screenLayout";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import {
  fullscreenButtonLabel,
  toggleFullscreen,
} from "../ui/fullscreen";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { SpellBarSortPanel } from "../ui/SpellBarSortPanel";
import { createDefaultSpellBarAutoCast } from "../content/spells";
import { spawnTownBuildings } from "../systems/TownBuildings";
import {
  formatTownBuildingButtonLabel,
  handleTownBuildingTap,
  townBuildingMenuIds,
  townBuildingSubtitle,
} from "../systems/townBuildingMenu";
import type { TouchButtonHandle } from "../ui/touchButton";

export class TownScene extends Phaser.Scene {
  private save!: SaveGame;
  private statusText!: Phaser.GameObjects.Text;
  private resetArmed = false;
  private resetButton!: ReturnType<typeof createTouchButton>;
  private buildingMenuButtons = new Map<string, TouchButtonHandle>();
  private statusFlashEvent: Phaser.Time.TimerEvent | null = null;
  private touchDebug!: TouchInputDebugDraw;
  private spellSortPanel: SpellBarSortPanel | null = null;

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
      .text(GAME.width / 2, titleY, "Town — Day", {
        fontSize: `${scaleUiX(28)}px`,
        color: "#f4f4f5",
        resolution: (this.registry.get("renderResolution") as number | undefined) ?? 1,
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(GAME.width / 2, scaleUiY(140), "", {
        fontSize: `${scaleUiX(18)}px`,
        color: "#a1a1aa",
        align: "center",
        wordWrap: { width: GAME.width - scaleUiX(48) },
        resolution: (this.registry.get("renderResolution") as number | undefined) ?? 1,
      })
      .setOrigin(0.5, 0);

    this.refreshStatus(store);

    spawnTownBuildings(this, store.townBuildings, store.townLayout);

    const safe = readSafeInsets();
    const dbgPos = debugButtonPosition(this, safe);
    createTouchButton(
      this,
      dbgPos.x,
      dbgPos.y,
      "Debug",
      () => this.scene.launch("DebugMenu"),
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

    const btnW = scaleUiX(260);
    const btnH = scaleUiY(40);
    const buildingFont = `${scaleUiX(13)}px`;
    const menuFill = 0x2d3748;
    const menuStroke = 0x4a5568;

    const menuIds = townBuildingMenuIds(store.townBuildings, store.townLayout);
    menuIds.forEach((buildingId, i) => {
      const def = store.townBuildings[buildingId];
      if (!def) return;
      const subtitle = townBuildingSubtitle(store, this.save, def);
      const isStartNight = Boolean(def.startsNight);
      const handle = createTouchButton(
        this,
        GAME.width / 2,
        townActionButtonY(this, safe, i),
        formatTownBuildingButtonLabel(def, subtitle),
        () => this.onTownBuildingTap(store, buildingId, def),
        {
          width: btnW,
          height: isStartNight ? scaleUiY(48) : btnH,
          depth: 200,
          fontSize: buildingFont,
          fillColor: isStartNight ? 0x3b82f6 : menuFill,
          strokeColor: isStartNight ? 0x60a5fa : menuStroke,
        },
      );
      handle.container.setData("testid", `town-building-${buildingId}`);
      if (isStartNight) {
        handle.container.setData("testid", "start-night");
      }
      this.buildingMenuButtons.set(buildingId, handle);
    });

    createTouchButton(
      this,
      GAME.width / 2,
      townActionButtonY(this, safe, menuIds.length),
      "Spell bar",
      () => this.openSpellSortPanel(),
      {
        width: btnW,
        height: scaleUiY(48),
        depth: 200,
        fillColor: menuFill,
        strokeColor: menuStroke,
      },
    );

    this.touchDebug = new TouchInputDebugDraw(this);
    this.events.on("shutdown", () => this.touchDebug.destroy());

    if (isE2EEnabled()) {
      publishE2E({ scene: "Town", ready: true });
    }
  }

  e2eStartNight(): void {
    this.beginDefenseNight();
  }

  e2eGetUiTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    for (const [id, btn] of this.buildingMenuButtons) {
      const br = interactiveObjectScreenRect(btn.container);
      if (!br) continue;
      const pt = {
        x: br.x + br.width / 2,
        y: br.y + br.height / 2,
      };
      out[`town-building-${id}`] = pt;
      const def = (this.registry.get("dataStore") as DataStore).townBuildings[id];
      if (def?.startsNight) {
        out["start-night"] = pt;
      }
    }
    return out;
  }

  e2eIsTouchButtonPressed(testId: string): boolean {
    if (testId === "start-night") {
      const btn = this.buildingMenuButtons.get("town_special_gallows_square");
      return btn
        ? isTouchButtonVisuallyPressed(btn.container)
        : false;
    }
    return false;
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

  private beginDefenseNight(): void {
    this.save = prepareDefenseNight(this.save);
    persistSave(this.save);
    this.registry.set("save", this.save);
    this.scene.start("Defense");
  }

  update(_time: number, _delta: number): void {
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => this.isPointerOverInteractive(pointer),
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
    const { save, result } = handleTownBuildingTap(store, this.save, def);
    if (result.kind === "startNight") {
      this.beginDefenseNight();
      return;
    }
    if (result.kind === "upgraded") {
      this.save = save;
      persistSave(this.save);
      this.registry.set("save", this.save);
      this.refreshBuildingMenuLabels(store);
      this.refreshStatus(store);
    }
    this.flashTransientStatus(result.message, store);
  }

  private refreshBuildingMenuLabels(store: DataStore): void {
    for (const [id, handle] of this.buildingMenuButtons) {
      const def = store.townBuildings[id];
      if (!def) continue;
      handle.setLabel(
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