import Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../ui/theme/uiPalette";
import {
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
import { isPointerOverInteractive } from "../input/pointerOverInteractive";
import { collectInteractiveScreenRects } from "../debug/collectInteractiveScreenRects";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { createTouchButton } from "../ui/touchButton";
import { hudBandHeight, readSafeInsets } from "../ui/screenLayout";
import { scaleUiX, scaleUiY } from "../config/uiScale";
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

type TouchButton = ReturnType<typeof createTouchButton>;

/** One debug menu row: its current label and what a tap does (returns the new label). */
type DebugMenuToggle = {
  label: () => string;
  toggle: () => string;
  activateOn?: "pointerup";
};

function registryFlagToggle(
  title: string,
  get: () => boolean,
  set: (next: boolean) => void,
): DebugMenuToggle {
  const label = (on: boolean) => `${title}: ${on ? "ON" : "OFF"}`;
  return {
    label: () => label(get()),
    toggle: () => {
      const next = !get();
      set(next);
      return label(next);
    },
  };
}

/** Overlay toggles (stored in the scene registry). */
function overlayToggles(registry: Phaser.Data.DataManager): DebugMenuToggle[] {
  return [
    registryFlagToggle(
      "Hitboxes",
      () => showHitboxes(registry),
      (v) => setShowHitboxes(registry, v),
    ),
    registryFlagToggle(
      "Combat ranges",
      () => showCombatRanges(registry),
      (v) => setShowCombatRanges(registry, v),
    ),
    registryFlagToggle(
      "Touch input",
      () => showTouchInput(registry),
      (v) => setShowTouchInput(registry, v),
    ),
    registryFlagToggle(
      "Enemy paths",
      () => showEnemyPaths(registry),
      (v) => setShowEnemyPaths(registry, v),
    ),
    registryFlagToggle(
      "FPS / frame time",
      () => showFpsCounter(registry),
      (v) => setShowFpsCounter(registry, v),
    ),
  ];
}

function pixelRenderToggle(
  game: Phaser.Game,
  title: string,
  get: (reg: Phaser.Data.DataManager) => boolean,
  set: (reg: Phaser.Data.DataManager, next: boolean) => void,
): DebugMenuToggle {
  const reg = game.registry;
  return {
    label: () => onOffLabel(title, get(reg)),
    toggle: () => {
      const next = !get(reg);
      set(reg, next);
      applyPixelRenderDebugSettings(game);
      return onOffLabel(title, next);
    },
  };
}

/** Rendering toggles (texture filter, pixel rounding, world scale, fullscreen). */
function renderToggles(scene: Phaser.Scene): DebugMenuToggle[] {
  const game = scene.game;
  return [
    {
      label: () =>
        worldTextureFilterLabel(getDebugWorldTextureFilter(game.registry)),
      toggle: () => worldTextureFilterLabel(cycleWorldTextureFilter(game)),
    },
    pixelRenderToggle(
      game,
      "Cam round px",
      getDebugCameraRoundPixels,
      setDebugCameraRoundPixels,
    ),
    pixelRenderToggle(
      game,
      "Renderer round px",
      getDebugRendererRoundPixels,
      setDebugRendererRoundPixels,
    ),
    pixelRenderToggle(
      game,
      "Scale autoRound",
      getDebugScaleAutoRound,
      setDebugScaleAutoRound,
    ),
    {
      label: () => worldScaleDebugLabel(getWorldPixelScale(scene.registry)),
      toggle: () => worldScaleDebugLabel(cycleDebugWorldPixelScale(game)),
    },
    {
      label: () => fullscreenButtonLabel(scene.scale),
      toggle: () => {
        toggleFullscreen(scene.scale);
        return fullscreenButtonLabel(scene.scale);
      },
      activateOn: "pointerup",
    },
  ];
}

/** Economy cheats (infinite gold / talent points). */
function economyToggles(reg: Phaser.Data.DataManager): DebugMenuToggle[] {
  return [
    {
      label: () => debugInfiniteGoldLabel(debugInfiniteGold(reg)),
      toggle: () => {
        const next = !debugInfiniteGold(reg);
        setDebugInfiniteGold(reg, next);
        return debugInfiniteGoldLabel(next);
      },
    },
    {
      label: () =>
        debugInfiniteTalentPointsLabel(debugInfiniteTalentPoints(reg)),
      toggle: () => {
        const next = !debugInfiniteTalentPoints(reg);
        setDebugInfiniteTalentPoints(reg, next);
        return debugInfiniteTalentPointsLabel(next);
      },
    },
  ];
}

export class DebugMenuScene extends Phaser.Scene {
  private touchDebug!: TouchInputDebugDraw;

  constructor() {
    super({ key: "DebugMenu" });
  }

  create(): void {
    configureSceneInput(this);

    const safe = readSafeInsets();
    const w = this.scale.width;
    const h = this.scale.height;
    const fromDefense = isDefenseDebugHost(this);
    const stackY = debugMenuStackCenterY(h, safe, fromDefense);

    this.buildBackdropAndTitle(w, h, hudBandHeight(safe.top) + scaleUiY(48));
    const toggles = [
      ...overlayToggles(this.registry),
      ...renderToggles(this),
      ...economyToggles(this.game.registry),
    ];
    for (const [index, t] of toggles.entries()) {
      this.buildToggleRow(t, w / 2, debugMenuRowY(stackY, index));
    }
    this.buildFooterButtons(w / 2, stackY, fromDefense);

    this.touchDebug = new TouchInputDebugDraw(this);
    this.events.on("shutdown", () => this.touchDebug.destroy());
  }

  private buildBackdropAndTitle(w: number, h: number, panelTop: number): void {
    this.add
      .rectangle(0, 0, w, h, PALETTE.black, 0.65)
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
          color: PALETTE_CSS.zinc50,
        }),
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(401);
  }

  private buildToggleRow(t: DebugMenuToggle, x: number, y: number): void {
    const button: TouchButton = createTouchButton(
      this,
      x,
      y,
      t.label(),
      () => button.setLabel(t.toggle()),
      t.activateOn ? { ...BTN, activateOn: t.activateOn } : BTN,
    );
  }

  private buildFooterButtons(
    x: number,
    stackY: number,
    fromDefense: boolean,
  ): void {
    if (fromDefense) {
      createTouchButton(
        this,
        x,
        stackY + DEBUG_MENU_GO_TO_TOWN_OFFSET,
        "Go to town",
        () => this.leaveDefenseForTown(),
        {
          width: scaleUiX(240),
          height: scaleUiY(48),
          depth: 402,
          fontSize: `${scaleUiX(18)}px`,
          fillColor: PALETTE.zinc700,
          strokeColor: PALETTE.zinc400,
        },
      );
    }

    const closeY = fromDefense
      ? stackY + DEBUG_MENU_CLOSE_OFFSET_DEFENSE
      : stackY + DEBUG_MENU_CLOSE_OFFSET_TOWN;
    createTouchButton(this, x, closeY, "Close", () => this.closeMenu(), {
      width: scaleUiX(160),
      height: scaleUiY(44),
      depth: 402,
      fontSize: `${scaleUiX(18)}px`,
    });
  }

  override update(_time: number, _delta: number): void {
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => isPointerOverInteractive(this, pointer),
      uiScreenRects: collectInteractiveScreenRects(this, {
        skip: [this.touchDebug.uiGraphics(), this.touchDebug.worldGraphics()],
      }),
    });
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
