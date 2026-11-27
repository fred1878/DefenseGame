import Phaser from "phaser";
import type { DefenseScene } from "../scenes/DefenseScene";
import type { TownScene } from "../scenes/TownScene";
import { activeTownUiHost, e2eReportsTownScene } from "./townUiHost";
import { onGameEvent } from "../core/gameEvents";
import { isE2EEnabled } from "./e2eMode";
import { publishE2E } from "./e2eGlobal";
import { buildApi } from "./installE2EApi";
import { createDefenseSceneE2eHost } from "../scenes/defense/DefenseSceneE2EHost";
import { registerDefenseSceneE2eHostFactory } from "../scenes/defense/defenseSceneE2eHook";
import { ensureDomTestActions, positionDomMirrors } from "./installE2EDom";

/*
 * E2E entry (lazy chunk, loaded by gameMain only in E2E mode): attach the
 * game and publish scene state. The window stub is seeded synchronously by
 * `seedE2EWindowStub` in `e2eGlobal.ts`.
 * DOM mirrors live in `installE2EDom.ts`, the API object in `installE2EApi.ts`.
 */

let unsubscribeGameEvents: (() => void) | null = null;

/** Mirror gameplay FX events into E2E flags (domain code never imports e2e/). */
export function subscribeE2EGameEvents(): void {
  if (unsubscribeGameEvents) return;
  const offs = [
    onGameEvent("playerMeleeFx", () => {
      publishE2E({ flags: { meleeFxSpawned: 1 } });
    }),
    onGameEvent("enemyMeleeFx", (e) => {
      publishE2E({
        flags: {
          enemyMeleeFxSpawned: 1,
          lastEnemyMeleeFxDef: e.enemyDefId,
          lastEnemyMeleeFxFacing: e.facingRad,
          lastEnemyMeleeFxRot: e.rotation,
          lastEnemyMeleeFxFlipX: e.flipX ? 1 : 0,
        },
      });
    }),
  ];
  unsubscribeGameEvents = () => {
    for (const off of offs) off();
    unsubscribeGameEvents = null;
  };
}

/** Tests: drop the E2E game-event listeners so later files start clean. */
export function unsubscribeE2EGameEvents(): void {
  unsubscribeGameEvents?.();
}

export function attachE2EGame(game: Phaser.Game): void {
  if (!isE2EEnabled()) return;

  subscribeE2EGameEvents();
  registerDefenseSceneE2eHostFactory(createDefenseSceneE2eHost);
  const api = buildApi(game);
  publishE2E({ api });
  ensureDomTestActions(api);

  const publishScene = (): void => {
    const townScene = game.scene.getScene("Town");
    const townRunning =
      townScene?.scene.isActive() === true ||
      townScene?.scene.isPaused?.() === true;
    const defense = game.scene.getScene("Defense");
    const defenseActive = defense?.scene.isActive() === true;
    const townLogical = e2eReportsTownScene(game);
    const key =
      defenseActive && !townRunning
        ? "Defense"
        : townLogical
          ? "Town"
          : (game.scene.getScenes(true).find((s) => s.scene.isActive())?.scene
              .key ?? "unknown");
    const ready = key === "Town" || key === "Defense";
    const patch: Parameters<typeof publishE2E>[0] = {
      scene: key,
      ready,
    };
    if (key === "Town" && ready) {
      const townHost = activeTownUiHost(game) as TownScene;
      positionDomMirrors(townHost.e2eGetUiTapTargets());
    }
    if (key === "Defense") {
      const defense = game.scene.getScene("Defense") as DefenseScene | null;
      const host = defense?.scene.isActive() ? defense.e2e : null;
      if (host?.isReady()) {
        patch.player = host.playerPosition();
        patch.flags = {
          attackPhase: host.attackPhase(),
          projectileCount: host.projectileCount(),
          enemyCount: host.enemyCount(),
          endlessMode: host.isEndlessMode(),
          endlessEnemyId: host.endlessEnemyId() ?? "",
          nightEnded: host.nightEnded(),
          hasReturnButton: host.hasReturnButton(),
          defenseWallHp: host.wallHp(),
          autoAttackOn: host.autoAttackEnabled(),
        };
        positionDomMirrors(host.getUiTapTargets());
      }
    }
    publishE2E(patch);
  };

  game.events.on(Phaser.Scenes.Events.TRANSITION_START, publishScene);
  game.events.on(Phaser.Scenes.Events.TRANSITION_COMPLETE, publishScene);
  game.events.on(Phaser.Scenes.Events.CREATE, publishScene);
  publishScene();
}
