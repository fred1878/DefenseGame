import Phaser from "phaser";
import type { DataStore } from "../../core/DataStore";
import { getDataStore } from "../../core/registryKeys";
import { showTouchInput } from "../../debug/DebugState";
import { FpsDebugOverlay } from "../../debug/FpsDebugOverlay";
import { TouchInputDebugDraw } from "../../debug/TouchInputDebugDraw";
import { collectInteractiveScreenRects } from "../../debug/collectInteractiveScreenRects";
import { publishE2E } from "../../e2e/e2eGlobal";
import { isE2EEnabled } from "../../e2e/e2eMode";
import { configureSceneInput } from "../../input/inputTuning";
import { isPointerOverInteractive } from "../../input/pointerOverInteractive";
import type { ScreenRect } from "../../ui/screenLayout";
import { closeTownSetupScene } from "./townSetupSceneLifecycle";

/**
 * Shared shell for the Town roster setup scenes (endless, wave planner): launch
 * data, touch-debug and FPS overlays, shutdown cleanup, the E2E "Town ready"
 * signal and the start/dismiss handshake. Subclasses only build their panel.
 */
export abstract class TownRosterSetupScene<
  Panel extends { destroy(): void },
  LaunchData,
> extends Phaser.Scene {
  protected panel: Panel | null = null;
  protected launchData!: LaunchData;
  protected touchDebug!: TouchInputDebugDraw;
  private fpsOverlay!: FpsDebugOverlay;
  private started = false;

  init(data: LaunchData): void {
    this.launchData = data;
    this.started = false;
  }

  create(): void {
    configureSceneInput(this);
    this.touchDebug = new TouchInputDebugDraw(this);
    this.fpsOverlay = new FpsDebugOverlay(this);

    this.openSetup(getDataStore(this.registry));

    this.events.on("shutdown", () => {
      this.onSetupShutdown();
      this.panel?.destroy();
      this.panel = null;
      this.touchDebug.destroy();
      this.fpsOverlay.destroy();
    });

    publishTownReadyForE2E();
  }

  /** Build the panel now or after readiness (call {@link showPanel} to mount it). */
  protected abstract openSetup(store: DataStore): void;

  /** Extra cleanup on shutdown, before the panel is destroyed. */
  protected onSetupShutdown(): void {}

  /** Touch-debug rects beyond the scene's interactive objects. */
  protected extraTouchDebugRects(): ScreenRect[] {
    return [];
  }

  /** Mount the panel once (no-op when one is open) and signal E2E readiness. */
  protected showPanel(create: () => Panel): void {
    if (this.panel) return;
    this.panel = create();
    publishTownReadyForE2E();
  }

  /** Panel "start" callback: close the setup scene, then launch the run. */
  protected startRun(launch: () => void): void {
    this.started = true;
    this.panel = null;
    closeTownSetupScene(this, launch);
  }

  /** Panel "close" callback (ignored once a run started). */
  protected dismissPanel(): void {
    if (this.started) return;
    this.panel = null;
    closeTownSetupScene(this);
  }

  override update(_time: number, delta: number): void {
    this.fpsOverlay.tick(this.registry, delta, this.game);
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => isPointerOverInteractive(this, pointer),
      uiScreenRects: this.collectTouchDebugRects(),
    });
  }

  protected collectTouchDebugRects(): ScreenRect[] {
    const skip = [
      this.touchDebug.uiGraphics(),
      this.touchDebug.worldGraphics(),
    ];
    const base = collectInteractiveScreenRects(this, { skip });
    const extra = this.extraTouchDebugRects();
    return extra.length > 0 ? [...base, ...extra] : base;
  }

  e2eTouchDebugRectCount(): number {
    return this.collectTouchDebugRects().length;
  }
}

function publishTownReadyForE2E(): void {
  if (isE2EEnabled()) {
    publishE2E({ scene: "Town", ready: true });
  }
}
