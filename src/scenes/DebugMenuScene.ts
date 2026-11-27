import Phaser from "phaser";
import {
  getDebugFlags,
  setShowCombatRanges,
  setShowEnemyPaths,
  setShowFpsCounter,
  setShowHitboxes,
  setShowTouchInput,
  showCombatRanges,
  showEnemyPaths,
  showFpsCounter,
  showHitboxes,
  showTouchInput,
} from "../debug/DebugState";
import { configureSceneInput } from "../input/inputTuning";
import { collectInteractiveScreenRects } from "../debug/collectInteractiveScreenRects";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { createTouchButton } from "../ui/touchButton";
import { hudBandHeight, readSafeInsets } from "../ui/screenLayout";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { uiTextStyle } from "../ui/uiTextStyle";
import {
  cycleDebugWorldPixelScale,
  worldScaleDebugLabel,
} from "../core/worldPixelScale";
import { getWorldPixelScale } from "../config/worldScale";
import { fullscreenButtonLabel, toggleFullscreen } from "../ui/fullscreen";
import {
  DEBUG_MENU_CLOSE,
  isDefenseDebugHost,
} from "../debug/debugMenuLifecycle";
import {
  debugMenuRowY,
  DEBUG_MENU_CLOSE_OFFSET_DEFENSE,
  DEBUG_MENU_CLOSE_OFFSET_TOWN,
  DEBUG_MENU_GO_TO_TOWN_OFFSET,
  debugMenuStackCenterY,
} from "../debug/debugMenuLayout";
import { transitionDefenseToTown } from "./defense/DefenseNightEnd";
import {
  applyPixelRenderDebugSettings,
  cycleWorldTextureFilter,
  getDebugCameraRoundPixels,
  getDebugRendererRoundPixels,
  getDebugScaleAutoRound,
  getDebugWorldTextureFilter,
  onOffLabel,
  setDebugCameraRoundPixels,
  setDebugRendererRoundPixels,
  setDebugScaleAutoRound,
  worldTextureFilterLabel,
} from "../core/pixelRenderDebug";
import {
  debugInfiniteGold,
  debugInfiniteGoldLabel,
  debugInfiniteTalentPoints,
  debugInfiniteTalentPointsLabel,
  setDebugInfiniteGold,
  setDebugInfiniteTalentPoints,
} from "../debug/debugEconomy";

const BTN = { width: scaleUiX(240), height: scaleUiY(48), depth: 402 as const };

export class DebugMenuScene extends Phaser.Scene {
  private hitboxToggle!: ReturnType<typeof createTouchButton>;
  private rangeToggle!: ReturnType<typeof createTouchButton>;
  private touchToggle!: ReturnType<typeof createTouchButton>;
  private pathToggle!: ReturnType<typeof createTouchButton>;
  private fpsToggle!: ReturnType<typeof createTouchButton>;
  private texFilterToggle!: ReturnType<typeof createTouchButton>;
  private camRoundToggle!: ReturnType<typeof createTouchButton>;
  private rendererRoundToggle!: ReturnType<typeof createTouchButton>;
  private scaleAutoRoundToggle!: ReturnType<typeof createTouchButton>;
  private worldScaleToggle!: ReturnType<typeof createTouchButton>;
  private fullscreenToggle!: ReturnType<typeof createTouchButton>;
  private infiniteGoldToggle!: ReturnType<typeof createTouchButton>;
  private infiniteTalentToggle!: ReturnType<typeof createTouchButton>;
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
    const fromDefense = isDefenseDebugHost(this);
    const stackY = debugMenuStackCenterY(h, safe, fromDefense);
    const rowY = (index: number) => debugMenuRowY(stackY, index);
    const closeY = fromDefense
      ? stackY + DEBUG_MENU_CLOSE_OFFSET_DEFENSE
      : stackY + DEBUG_MENU_CLOSE_OFFSET_TOWN;

    this.add
      .rectangle(0, 0, w, h, 0x000000, 0.65)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(400)
      .setInteractive();

    this.add
      .text(
        w / 2,
        panelTop,
        "Debug",
        uiTextStyle(this, {
          fontSize: `${scaleUiX(26)}px`,
          color: "#fafafa",
        }),
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(401);

    const flags = getDebugFlags(this.registry);
    this.hitboxToggle = createTouchButton(
      this,
      w / 2,
      rowY(0),
      flags.showHitboxes ? "Hitboxes: ON" : "Hitboxes: OFF",
      () => {
        const next = !showHitboxes(this.registry);
        setShowHitboxes(this.registry, next);
        this.hitboxToggle.setLabel(next ? "Hitboxes: ON" : "Hitboxes: OFF");
      },
      BTN,
    );

    this.rangeToggle = createTouchButton(
      this,
      w / 2,
      rowY(1),
      flags.showCombatRanges ? "Combat ranges: ON" : "Combat ranges: OFF",
      () => {
        const next = !showCombatRanges(this.registry);
        setShowCombatRanges(this.registry, next);
        this.rangeToggle.setLabel(
          next ? "Combat ranges: ON" : "Combat ranges: OFF",
        );
      },
      BTN,
    );

    this.touchToggle = createTouchButton(
      this,
      w / 2,
      rowY(2),
      flags.showTouchInput ? "Touch input: ON" : "Touch input: OFF",
      () => {
        const next = !showTouchInput(this.registry);
        setShowTouchInput(this.registry, next);
        this.touchToggle.setLabel(
          next ? "Touch input: ON" : "Touch input: OFF",
        );
      },
      BTN,
    );

    this.pathToggle = createTouchButton(
      this,
      w / 2,
      rowY(3),
      flags.showEnemyPaths ? "Enemy paths: ON" : "Enemy paths: OFF",
      () => {
        const next = !showEnemyPaths(this.registry);
        setShowEnemyPaths(this.registry, next);
        this.pathToggle.setLabel(next ? "Enemy paths: ON" : "Enemy paths: OFF");
      },
      BTN,
    );

    this.fpsToggle = createTouchButton(
      this,
      w / 2,
      rowY(4),
      flags.showFpsCounter ? "FPS / frame time: ON" : "FPS / frame time: OFF",
      () => {
        const next = !showFpsCounter(this.registry);
        setShowFpsCounter(this.registry, next);
        this.fpsToggle.setLabel(
          next ? "FPS / frame time: ON" : "FPS / frame time: OFF",
        );
      },
      BTN,
    );

    const reg = this.game.registry;
    this.texFilterToggle = createTouchButton(
      this,
      w / 2,
      rowY(5),
      worldTextureFilterLabel(getDebugWorldTextureFilter(reg)),
      () => {
        const next = cycleWorldTextureFilter(this.game);
        this.texFilterToggle.setLabel(worldTextureFilterLabel(next));
      },
      BTN,
    );

    this.camRoundToggle = createTouchButton(
      this,
      w / 2,
      rowY(6),
      onOffLabel("Cam round px", getDebugCameraRoundPixels(reg)),
      () => {
        const next = !getDebugCameraRoundPixels(reg);
        setDebugCameraRoundPixels(reg, next);
        applyPixelRenderDebugSettings(this.game);
        this.camRoundToggle.setLabel(onOffLabel("Cam round px", next));
      },
      BTN,
    );

    this.rendererRoundToggle = createTouchButton(
      this,
      w / 2,
      rowY(7),
      onOffLabel("Renderer round px", getDebugRendererRoundPixels(reg)),
      () => {
        const next = !getDebugRendererRoundPixels(reg);
        setDebugRendererRoundPixels(reg, next);
        applyPixelRenderDebugSettings(this.game);
        this.rendererRoundToggle.setLabel(
          onOffLabel("Renderer round px", next),
        );
      },
      BTN,
    );

    this.scaleAutoRoundToggle = createTouchButton(
      this,
      w / 2,
      rowY(8),
      onOffLabel("Scale autoRound", getDebugScaleAutoRound(reg)),
      () => {
        const next = !getDebugScaleAutoRound(reg);
        setDebugScaleAutoRound(reg, next);
        applyPixelRenderDebugSettings(this.game);
        this.scaleAutoRoundToggle.setLabel(onOffLabel("Scale autoRound", next));
      },
      BTN,
    );

    this.worldScaleToggle = createTouchButton(
      this,
      w / 2,
      rowY(9),
      worldScaleDebugLabel(getWorldPixelScale(this.registry)),
      () => {
        const next = cycleDebugWorldPixelScale(this.game);
        this.worldScaleToggle.setLabel(worldScaleDebugLabel(next));
      },
      BTN,
    );

    this.fullscreenToggle = createTouchButton(
      this,
      w / 2,
      rowY(10),
      fullscreenButtonLabel(this.scale),
      () => {
        toggleFullscreen(this.scale);
        this.fullscreenToggle.setLabel(fullscreenButtonLabel(this.scale));
      },
      {
        ...BTN,
        activateOn: "pointerup",
      },
    );

    this.infiniteGoldToggle = createTouchButton(
      this,
      w / 2,
      rowY(11),
      debugInfiniteGoldLabel(debugInfiniteGold(reg)),
      () => {
        const next = !debugInfiniteGold(reg);
        setDebugInfiniteGold(reg, next);
        this.infiniteGoldToggle.setLabel(debugInfiniteGoldLabel(next));
      },
      BTN,
    );

    this.infiniteTalentToggle = createTouchButton(
      this,
      w / 2,
      rowY(12),
      debugInfiniteTalentPointsLabel(debugInfiniteTalentPoints(reg)),
      () => {
        const next = !debugInfiniteTalentPoints(reg);
        setDebugInfiniteTalentPoints(reg, next);
        this.infiniteTalentToggle.setLabel(
          debugInfiniteTalentPointsLabel(next),
        );
      },
      BTN,
    );

    if (fromDefense) {
      createTouchButton(
        this,
        w / 2,
        stackY + DEBUG_MENU_GO_TO_TOWN_OFFSET,
        "Go to town",
        () => this.leaveDefenseForTown(),
        {
          width: scaleUiX(240),
          height: scaleUiY(48),
          depth: 402,
          fontSize: `${scaleUiX(18)}px`,
          fillColor: 0x3f3f46,
          strokeColor: 0xa1a1aa,
        },
      );
    }

    createTouchButton(this, w / 2, closeY, "Close", () => this.closeMenu(), {
      width: scaleUiX(160),
      height: scaleUiY(44),
      depth: 402,
      fontSize: `${scaleUiX(18)}px`,
    });

    this.touchDebug = new TouchInputDebugDraw(this);
    this.events.on("shutdown", () => this.touchDebug.destroy());
  }

  override update(_time: number, _delta: number): void {
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => this.isPointerOverInteractive(pointer),
      uiScreenRects: collectInteractiveScreenRects(this, {
        skip: [this.touchDebug.uiGraphics(), this.touchDebug.worldGraphics()],
      }),
    });
  }

  private isPointerOverInteractive(pointer: Phaser.Input.Pointer): boolean {
    const hits = this.input.hitTestPointer(pointer);
    for (const hit of hits) {
      if (this.hasInteractiveInput(hit as Phaser.GameObjects.GameObject))
        return true;
    }
    return false;
  }

  private hasInteractiveInput(obj: Phaser.GameObjects.GameObject): boolean {
    let node: Phaser.GameObjects.GameObject | null = obj;
    while (node) {
      if (node.input?.enabled) return true;
      const parent: Phaser.GameObjects.Container | null =
        (
          node as Phaser.GameObjects.GameObject & {
            parentContainer?: Phaser.GameObjects.Container;
          }
        ).parentContainer ?? null;
      node = parent;
    }
    return false;
  }

  private closeMenu(): void {
    this.game.events.emit(DEBUG_MENU_CLOSE);
    this.scene.stop("DebugMenu");
  }

  /** Mid-night exit — same deferred Town transition as Return to town (#169). */
  private leaveDefenseForTown(): void {
    if (!isDefenseDebugHost(this)) return;
    const defense = this.scene.get("Defense");
    if (!defense) return;
    transitionDefenseToTown(defense);
  }
}
