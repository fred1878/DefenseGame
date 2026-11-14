import Phaser from "phaser";
import { GAME, type SaveGame } from "../config";
import { DataStore } from "../core/DataStore";
import {
  playerDamageMult,
  persistSave,
  prepareDefenseNight,
  resetSaveAndReload,
  wallHpBonusFromBuildings,
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
import { UI_TEXTURE } from "../config/assets";
import {
  createTownHudChrome,
  townActionStackMetrics,
} from "../ui/townHudChrome";

export class TownScene extends Phaser.Scene {
  private save!: SaveGame;
  private statusText!: Phaser.GameObjects.Text;
  private resetArmed = false;
  private resetButton!: ReturnType<typeof createTouchButton>;
  private startNightButton!: ReturnType<typeof createTouchButton>;
  private touchDebug!: TouchInputDebugDraw;

  constructor() {
    super({ key: "Town" });
  }

  create(): void {
    configureSceneInput(this);
    this.save = this.registry.get("save") as SaveGame;
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
    const btnH = scaleUiY(48);
    const yStart = townActionButtonY(this, safe, 0);
    const ySmith = townActionButtonY(this, safe, 2);
    const stackMetrics = townActionStackMetrics(
      this,
      safe,
      btnH,
      btnW,
      yStart,
      ySmith,
    );
    createTownHudChrome(
      this,
      safe,
      stackMetrics.centerY,
      stackMetrics.panelHeight,
      stackMetrics.panelWidth,
    );

    const townBtnStyle = {
      width: btnW,
      height: btnH,
      depth: 200,
      frameTextureKey: UI_TEXTURE.modeRect,
      fontSize: `${scaleUiX(18)}px`,
    } as const;

    this.startNightButton = createTouchButton(
      this,
      GAME.width / 2,
      yStart,
      "Start night",
      () => this.beginDefenseNight(),
      townBtnStyle,
    );

    createTouchButton(
      this,
      GAME.width / 2,
      townActionButtonY(this, safe, 1),
      "Upgrade wall",
      () => this.tryUpgrade(store, "wall"),
      townBtnStyle,
    );

    createTouchButton(
      this,
      GAME.width / 2,
      ySmith,
      "Upgrade blacksmith",
      () => this.tryUpgrade(store, "blacksmith"),
      townBtnStyle,
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
    const r = interactiveObjectScreenRect(this.startNightButton.container);
    if (!r) return {};
    return {
      "start-night": {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      },
    };
  }

  e2eIsTouchButtonPressed(testId: string): boolean {
    if (testId === "start-night") {
      return isTouchButtonVisuallyPressed(this.startNightButton.container);
    }
    return false;
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

  private tryUpgrade(store: DataStore, id: string): void {
    const def = store.buildings[id];
    if (!def) return;
    const level = this.save.buildings[id] ?? 0;
    if (level >= def.maxLevel) return;
    const cost = def.costByLevel[level];
    if (cost === undefined || this.save.gold < cost) return;

    this.save.gold -= cost;
    this.save.buildings[id] = level + 1;
    if (def.effect === "wallHpMax") {
      const bonus = wallHpBonusFromBuildings(this.save.buildings);
      this.save.townWallHpMax = 100 + bonus;
      this.save.townWallHp = Math.min(this.save.townWallHp, this.save.townWallHpMax);
    }
    persistSave(this.save);
    this.registry.set("save", this.save);
    this.refreshStatus(store);
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