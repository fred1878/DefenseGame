import Phaser from "phaser";
import type { DefenseScene } from "../scenes/DefenseScene";
import type { TownScene } from "../scenes/TownScene";
import { activeTownUiHost, e2eReportsTownScene } from "./townUiHost";
import { onGameEvent } from "../core/gameEvents";
import { isE2EEnabled } from "./e2eMode";
import { publishE2E } from "./e2eGlobal";
import { buildApi } from "./installE2EApi";
import { ensureDomTestActions, positionDomMirrors } from "./installE2EDom";

/*
 * E2E entry (lazy chunk, loaded by gameMain only in E2E mode): attach the
 * game and publish scene state. The window stub is seeded synchronously by
 * `seedE2EWindowStub` in `e2eGlobal.ts`.
 * DOM mirrors live in `installE2EDom.ts`, the API object in `installE2EApi.ts`.
 */

let gameEventsSubscribed = false;

/** Mirror gameplay FX events into E2E flags (domain code never imports e2e/). */
export function subscribeE2EGameEvents(): void {
  if (gameEventsSubscribed) return;
  gameEventsSubscribed = true;
  onGameEvent("playerMeleeFx", () => {
    publishE2E({ flags: { meleeFxSpawned: 1 } });
  });
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
  });
}

export function attachE2EGame(game: Phaser.Game): void {
  if (!isE2EEnabled()) return;

  subscribeE2EGameEvents();
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
      if (defense?.scene.isActive() && defense.e2e.isReady()) {
        patch.player = defense.e2e.playerPosition();
        patch.flags = {
          attackPhase: defense.e2e.attackPhase(),
          projectileCount: defense.e2e.projectileCount(),
          enemyCount: defense.e2e.enemyCount(),
          endlessMode: defense.e2e.isEndlessMode(),
          endlessEnemyId: defense.e2e.endlessEnemyId() ?? "",
          nightEnded: defense.e2e.nightEnded(),
          hasReturnButton: defense.e2e.hasReturnButton(),
          defenseWallHp: defense.e2e.wallHp(),
          autoAttackOn: defense.e2e.autoAttackEnabled(),
        };
        positionDomMirrors(defense.e2e.getUiTapTargets());
      }
    }
    publishE2E(patch);
  };

  game.events.on(Phaser.Scenes.Events.TRANSITION_START, publishScene);
  game.events.on(Phaser.Scenes.Events.TRANSITION_COMPLETE, publishScene);
  game.events.on(Phaser.Scenes.Events.CREATE, publishScene);
  publishScene();
}
