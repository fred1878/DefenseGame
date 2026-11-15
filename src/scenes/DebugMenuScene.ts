import Phaser from "phaser";
import {
  getDebugFlags,
  setShowEnemyPaths,
  setShowHitboxes,
  setShowTouchInput,
  showEnemyPaths,
  showHitboxes,
  showTouchInput,
} from "../debug/DebugState";
import { configureSceneInput } from "../input/inputTuning";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { createTouchButton } from "../ui/touchButton";
import { hudBandHeight, readSafeInsets } from "../ui/screenLayout";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import {
  cycleDebugWorldPixelScale,
  getWorldPixelScale,
  worldScaleDebugLabel,
} from "../core/worldPixelScale";
import {
  fullscreenButtonLabel,
  toggleFullscreen,
} from "../ui/fullscreen";

export class DebugMenuScene extends Phaser.Scene {
  private hitboxToggle!: ReturnType<typeof createTouchButton>;
  private touchToggle!: ReturnType<typeof createTouchButton>;
  private pathToggle!: ReturnType<typeof createTouchButton>;
  private fullscreenToggle!: ReturnType<typeof createTouchButton>;
  private worldScaleToggle!: ReturnType<typeof createTouchButton>;
  private touchDebug!: TouchInputDebugDraw;

  constructor() {
    super({ key: "DebugMenu" });
  }

  create(): void {
    configureSceneInput(this);

    const safe = readSafeInsets();
    const w = this.scale.width;
    const h = this.scale.height;
     const panelTop = hudBandHeight(safe.top) + scaleUiY(48);

    this.add
      .rectangle(0, 0, w, h, 0x000000, 0.65)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(400)
      .setInteractive();

    this.add
      .text(w / 2, panelTop, "Debug", {
        fontSize: `${scaleUiX(26)}px`,
        color: "#fafafa",
        resolution: (this.registry.get("renderResolution") as number | undefined) ?? 1,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(401);

    const flags = getDebugFlags(this.registry);
    this.hitboxToggle = createTouchButton(
      this,
      w / 2,
      h / 2 - scaleUiY(60),
      flags.showHitboxes ? "Hitboxes: ON" : "Hitboxes: OFF",
      () => {
        const next = !showHitboxes(this.registry);
        setShowHitboxes(this.registry, next);
        this.hitboxToggle.setLabel(next ? "Hitboxes: ON" : "Hitboxes: OFF");
      },
      { width: scaleUiX(240), height: scaleUiY(48), depth: 402 },
    );

    this.touchToggle = createTouchButton(
      this,
      w / 2,
      h / 2 + scaleUiY(5),
      flags.showTouchInput ? "Touch input: ON" : "Touch input: OFF",
      () => {
        const next = !showTouchInput(this.registry);
        setShowTouchInput(this.registry, next);
        this.touchToggle.setLabel(next ? "Touch input: ON" : "Touch input: OFF");
      },
      { width: scaleUiX(240), height: scaleUiY(48), depth: 402 },
    );

    this.pathToggle = createTouchButton(
      this,
      w / 2,
      h / 2 + scaleUiY(70),
      flags.showEnemyPaths ? "Enemy paths: ON" : "Enemy paths: OFF",
      () => {
        const next = !showEnemyPaths(this.registry);
        setShowEnemyPaths(this.registry, next);
        this.pathToggle.setLabel(next ? "Enemy paths: ON" : "Enemy paths: OFF");
      },
      { width: scaleUiX(240), height: scaleUiY(48), depth: 402 },
    );

    this.worldScaleToggle = createTouchButton(
      this,
      w / 2,
      h / 2 + scaleUiY(135),
      worldScaleDebugLabel(getWorldPixelScale(this.registry)),
      () => {
        const next = cycleDebugWorldPixelScale(this.game);
        this.worldScaleToggle.setLabel(worldScaleDebugLabel(next));
      },
      { width: scaleUiX(240), height: scaleUiY(48), depth: 402 },
    );

    this.fullscreenToggle = createTouchButton(
      this,
      w / 2,
      h / 2 + scaleUiY(200),
      fullscreenButtonLabel(this.scale),
      () => {
        toggleFullscreen(this.scale);
        this.fullscreenToggle.setLabel(fullscreenButtonLabel(this.scale));
      },
      {
        width: scaleUiX(240),
        height: scaleUiY(48),
        depth: 402,
        activateOn: "pointerup",
      },
    );

    createTouchButton(
      this,
      w / 2,
      h / 2 + scaleUiY(270),
      "Close",
      () => this.closeMenu(),
      {
        width: scaleUiX(160),
        height: scaleUiY(44),
        depth: 402,
        fontSize: `${scaleUiX(18)}px`,
      },
    );

    this.touchDebug = new TouchInputDebugDraw(this);
    this.events.on("shutdown", () => this.touchDebug.destroy());
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

  private closeMenu(): void {
    this.game.events.emit("debug-menu-close");
    this.scene.stop("DebugMenu");
  }
}