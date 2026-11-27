import Phaser from "phaser";
import type { WaveGroup } from "../core/DataStore";
import {
  ensureTownReachableReady,
  isTownReachableReady,
} from "./loading/GameAssetLoader";
import { showTouchInput } from "../debug/DebugState";
import { FpsDebugOverlay } from "../debug/FpsDebugOverlay";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { collectInteractiveScreenRects } from "../debug/collectInteractiveScreenRects";
import { configureSceneInput } from "../input/inputTuning";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { WavePlannerPanel } from "../ui/WavePlannerPanel";
import {
  closeTownSetupScene,
  TOWN_WAVE_PLANNER_SETUP_SCENE_KEY,
  type WavePlannerSetupLaunchData,
} from "./town/townSetupSceneLifecycle";
import { isPointerOverInteractive } from "../input/pointerOverInteractive";
import { getDataStore } from "../core/registryKeys";

export class WavePlannerSetupScene extends Phaser.Scene {
  private panel: WavePlannerPanel | null = null;
  private touchDebug!: TouchInputDebugDraw;
  private fpsOverlay!: FpsDebugOverlay;
  private launchData!: WavePlannerSetupLaunchData;
  private started = false;

  constructor() {
    super({ key: TOWN_WAVE_PLANNER_SETUP_SCENE_KEY });
  }

  init(data: WavePlannerSetupLaunchData): void {
    this.launchData = data;
    this.started = false;
  }

  create(): void {
    configureSceneInput(this);
    this.touchDebug = new TouchInputDebugDraw(this);
    this.fpsOverlay = new FpsDebugOverlay(this);

    const store = getDataStore(this.registry);
    const open = (): void => {
      if (this.panel) return;
      this.panel = new WavePlannerPanel(
        this,
        store,
        (groups: WaveGroup[]) => {
          this.started = true;
          const launch = this.launchData;
          this.panel = null;
          closeTownSetupScene(this, () => launch.onStart(groups));
        },
        () => {
          if (this.started) return;
          this.panel = null;
          closeTownSetupScene(this);
        },
      );
      if (isE2EEnabled()) {
        publishE2E({ scene: "Town", ready: true });
      }
    };

    if (isTownReachableReady(this.game, store)) {
      open();
    } else {
      void ensureTownReachableReady(this, store).then(open);
    }

    this.events.on("shutdown", () => {
      this.panel?.destroy();
      this.panel = null;
      this.touchDebug.destroy();
      this.fpsOverlay.destroy();
    });

    if (isE2EEnabled()) {
      publishE2E({ scene: "Town", ready: true });
    }
  }

  override update(_time: number, delta: number): void {
    this.fpsOverlay.tick(this.registry, delta, this.game);
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    const skip = [
      this.touchDebug.uiGraphics(),
      this.touchDebug.worldGraphics(),
    ];
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => isPointerOverInteractive(this, pointer),
      uiScreenRects: collectInteractiveScreenRects(this, { skip }),
    });
  }

  e2eGetUiTapTargets(): Record<string, { x: number; y: number }> {
    if (!this.panel) return {};
    return this.panel.e2eTapTargets();
  }

  e2eIsOpen(): boolean {
    return this.panel !== null;
  }

  e2eTouchDebugRectCount(): number {
    const skip = [
      this.touchDebug.uiGraphics(),
      this.touchDebug.worldGraphics(),
    ];
    return collectInteractiveScreenRects(this, { skip }).length;
  }
}
