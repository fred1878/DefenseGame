import Phaser from "phaser";
import { COMBAT_FX_ASSETS, SPELL_FX_ASSETS } from "../content/assets";
import { HOLY_FX_ASSETS } from "../content/holyFxAssets";
import { ICE_FX_ASSETS } from "../content/iceFxAssets";
import { PVFX_FX_ASSETS } from "../content/combatPvfxAssets";
import { MELEE_FX_ASSETS } from "../content/meleeFxAssets";
import type { DefenseScene } from "../scenes/DefenseScene";
import type { TownScene } from "../scenes/TownScene";
import { isE2EEnabled } from "./e2eMode";
import { defaultE2EState, publishE2E } from "./e2eGlobal";
import { buildApi } from "./installE2EApi";
import { ensureDomTestActions, positionDomMirrors } from "./installE2EDom";

/*
 * E2E entry: seed the window hook, attach the game, publish scene state.
 * DOM mirrors live in `installE2EDom.ts`, the API object in `installE2EApi.ts`.
 */

/** Call at module load so Playwright always sees the hook object (before async boot). */
export function seedE2EWindowStub(): void {
  if (!isE2EEnabled() || typeof window === "undefined") return;
  window.__DEFENSEGAME_E2E__ = defaultE2EState();
}

export function attachE2EGame(game: Phaser.Game): void {
  if (!isE2EEnabled()) return;

  const api = buildApi(game);
  publishE2E({ api });
  ensureDomTestActions(api);

  const publishScene = (): void => {
    const active = game.scene
      .getScenes(true)
      .find((s) => s.scene.isActive());
    const key = active?.scene.key ?? "unknown";
    const ready = key === "Town" || key === "Defense";
    const patch: Parameters<typeof publishE2E>[0] = {
      scene: key,
      ready,
    };
    if (key === "Town" && ready) {
      const town = active as TownScene;
      positionDomMirrors(town.e2eGetUiTapTargets());
    }
    if (key === "Defense") {
      const defense = game.scene.getScene("Defense") as DefenseScene | null;
      if (defense?.scene.isActive() && defense.e2eIsReady()) {
        patch.player = defense.e2ePlayerPosition();
        patch.flags = {
          attackPhase: defense.e2eAttackPhase(),
          projectileCount: defense.e2eProjectileCount(),
          enemyCount: defense.e2eEnemyCount(),
          endlessMode: defense.e2eIsEndlessMode(),
          endlessEnemyId: defense.e2eEndlessEnemyId() ?? "",
          nightEnded: defense.e2eNightEnded(),
          hasReturnButton: defense.e2eHasReturnButton(),
          defenseWallHp: defense.e2eWallHp(),
          autoAttackOn: defense.e2eAutoAttackEnabled(),
        };
        positionDomMirrors(defense.e2eGetUiTapTargets());
      }
    }
    publishE2E(patch);
  };

  game.events.on(Phaser.Scenes.Events.TRANSITION_START, publishScene);
  game.events.on(Phaser.Scenes.Events.TRANSITION_COMPLETE, publishScene);
  game.events.on(Phaser.Scenes.Events.CREATE, publishScene);
  publishScene();
}

export function markE2EAssetsLoaded(game: Phaser.Game): void {
  if (!isE2EEnabled()) return;
  const keys = [
    ...COMBAT_FX_ASSETS.map((a) => a.key),
    ...SPELL_FX_ASSETS.map((a) => a.key),
    ...HOLY_FX_ASSETS.map((a) => a.key),
    ...ICE_FX_ASSETS.map((a) => a.key),
    ...PVFX_FX_ASSETS.map((a) => a.key),
    ...MELEE_FX_ASSETS.map((a) => a.key),
  ];
  const ok = keys.every((k) => game.textures.exists(k));
  publishE2E({ assetsLoaded: ok, flags: { combatFxKeys: keys.join(",") } });
}
