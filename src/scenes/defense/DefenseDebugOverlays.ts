import type Phaser from "phaser";
import { anyDebugOverlayOn } from "../../debug/DebugState";
import { FpsDebugOverlay } from "../../debug/FpsDebugOverlay";
import type { NavGrid } from "../../pathfinding/grid";
import type { DefenseRunState } from "./DefenseRunState";
import {
  createDefenseDebugDrawers,
  type DefenseDebugDrawers,
  drawDefenseCombatDebug,
  drawDefenseEnemyPaths,
  drawDefenseTouchDebug,
} from "./DefenseDebugDraw";

export type DefenseDebugOverlaysHost = {
  scene: Phaser.Scene;
  run: DefenseRunState;
  navGrid: () => NavGrid;
  wu: (atDefault2x: number) => number;
  registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void;
  registerUiDraw: (go: Phaser.GameObjects.GameObject) => void;
};

/**
 * The night's debug overlays (hitboxes, ranges, enemy paths, touch input, FPS),
 * drawn once per frame by `DefenseScene.update`.
 */
export class DefenseDebugOverlays {
  readonly drawers: DefenseDebugDrawers;
  readonly fpsOverlay: FpsDebugOverlay;
  /**
   * Overlays only clear/hide themselves while every flag is off, so after one
   * clearing pass they are skipped until a flag turns on again.
   */
  private active = true;

  constructor(private readonly host: DefenseDebugOverlaysHost) {
    this.drawers = createDefenseDebugDrawers(
      host.scene,
      host.registerWorldDraw,
      host.registerUiDraw,
    );
    this.fpsOverlay = new FpsDebugOverlay(host.scene, host.registerUiDraw);
  }

  draw(delta: number): void {
    const { scene, run } = this.host;
    const registry = scene.registry;
    const anyOn = anyDebugOverlayOn(registry);
    if (!anyOn && !this.active) {
      // Touch debug drops the tap flash while it is off.
      run.focusTapFlash = null;
      return;
    }
    this.active = anyOn;
    const { hitboxDebug, rangeDebug, pathDebug, touchDebug } = this.drawers;
    drawDefenseCombatDebug({
      registry,
      rangeDebug,
      hitboxDebug,
      player: run.player,
      enemies: run.enemies,
      projectiles: run.projectiles,
      enemyProjectiles: run.enemyProjectiles,
      obstacleBlockers: run.obstacleBlockers,
      wu: this.host.wu,
      delta,
    });
    drawDefenseEnemyPaths({
      registry,
      pathDebug,
      navGrid: this.host.navGrid(),
      obstacleBlockers: run.obstacleBlockers,
      enemies: run.enemies,
      enemyPathGoals: run.enemyPathGoals,
    });
    run.focusTapFlash = drawDefenseTouchDebug(
      {
        scene,
        registry,
        touchDebug,
        stick: run.stick,
        focusTapFlash: run.focusTapFlash,
        pointerUiBlocked: (p) => run.targeting.isPointerOverUi(p),
      },
      delta,
    );
    this.fpsOverlay.tick(registry, delta, scene.game);
  }
}
