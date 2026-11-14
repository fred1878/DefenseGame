import Phaser from "phaser";
import type { SaveGame } from "../config";
import { COMBAT_FX_ASSETS } from "../config/assets";
import { persistSave } from "../core/GameState";
import type { DefenseScene } from "../scenes/DefenseScene";
import { isE2EEnabled } from "./e2eMode";
import {
  defaultE2EState,
  getE2EState,
  publishE2E,
  type DefenseGameE2EApi,
} from "./e2eGlobal";

function ensureDomTestActions(api: DefenseGameE2EApi): void {
  if (!isE2EEnabled() || typeof document === "undefined") return;
  let host = document.getElementById("defensegame-e2e-dom");
  if (!host) {
    host = document.createElement("div");
    host.id = "defensegame-e2e-dom";
    host.setAttribute("data-testid", "e2e-dom-root");
    host.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0";
    document.body.appendChild(host);
  }
  if (!host.querySelector("[data-testid='start-night']")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-testid", "start-night");
    btn.textContent = "Start night";
    btn.addEventListener("click", () => api.startNight());
    host.appendChild(btn);
  }
}

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
    if (key === "Defense") {
      const defense = game.scene.getScene("Defense") as DefenseScene | null;
      if (defense?.scene.isActive() && defense.e2eIsReady()) {
        patch.player = defense.e2ePlayerPosition();
        patch.flags = {
          attackPhase: defense.e2eAttackPhase(),
          projectileCount: defense.e2eProjectileCount(),
          enemyCount: defense.e2eEnemyCount(),
        };
      }
    }
    publishE2E(patch);
  };

  game.events.on(Phaser.Scenes.Events.TRANSITION_START, publishScene);
  game.events.on(Phaser.Scenes.Events.TRANSITION_COMPLETE, publishScene);
  game.events.on(Phaser.Scenes.Events.CREATE, publishScene);
  publishScene();
}

function buildApi(game: Phaser.Game): DefenseGameE2EApi {
  return {
    startNight() {
      const town = game.scene.getScene("Town");
      if (town) {
        town.scene.start("Defense");
        return;
      }
      game.scene.start("Defense");
    },
    async setStick(dx, dy, ms = 0) {
      const defense = activeDefense(game);
      if (!defense) return;
      defense.e2eSetStick(dx, dy);
      if (ms <= 0) return;
      await waitGameMs(game, ms);
      defense.e2eSetStick(0, 0);
    },
    clearStick() {
      activeDefense(game)?.e2eSetStick(0, 0);
    },
    tapMelee() {
      activeDefense(game)?.e2eTapMelee();
    },
    tapRanged() {
      activeDefense(game)?.e2eTapRanged();
    },
    async castSpell(slot: number) {
      const defense = activeDefense(game);
      if (!defense) return;
      await defense.e2eCastSpellSlot(slot);
    },
    getSave() {
      const save = game.registry.get("save") as SaveGame | undefined;
      return save ? structuredClone(save) : null;
    },
    setSave(partial: Partial<SaveGame>) {
      const cur = game.registry.get("save") as SaveGame | undefined;
      if (!cur) return;
      const next = structuredClone({
        ...cur,
        ...partial,
        player: { ...cur.player, ...partial.player },
        buildings: { ...cur.buildings, ...partial.buildings },
        spellBar: partial.spellBar ?? cur.spellBar,
        flags: partial.flags ?? cur.flags,
      });
      game.registry.set("save", next);
      persistSave(next);
    },
    spawnTestEnemy(x = 80, y = 0) {
      activeDefense(game)?.e2eSpawnEnemy(x, y);
    },
    setGodMode(on: boolean) {
      game.registry.set("e2eGodMode", on);
      getE2EState().flags.godMode = on;
    },
    damagePlayer(amount: number) {
      activeDefense(game)?.e2eDamagePlayer(amount);
    },
    killAllEnemies() {
      activeDefense(game)?.e2eKillAllEnemies();
    },
    forceWinNight() {
      activeDefense(game)?.e2eForceWinNight();
    },
    textureLoaded(key: string) {
      return game.textures.exists(key);
    },
    async sampleFps(seconds = 5) {
      const samples: number[] = [];
      const interval = 100;
      const end = Date.now() + seconds * 1000;
      while (Date.now() < end) {
        samples.push(game.loop.actualFps);
        await new Promise((r) => setTimeout(r, interval));
      }
      if (samples.length === 0) return game.loop.actualFps;
      return (
        samples.reduce((a, b) => a + b, 0) / samples.length
      );
    },
    getAttackPhase() {
      return activeDefense(game)?.e2eAttackPhase() ?? "idle";
    },
    getProjectileCount() {
      return activeDefense(game)?.e2eProjectileCount() ?? 0;
    },
  };
}

function activeDefense(game: Phaser.Game): DefenseScene | null {
  const defense = game.scene.getScene("Defense") as DefenseScene | null;
  return defense?.scene.isActive() ? defense : null;
}

function waitGameMs(game: Phaser.Game, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const start = game.loop.time;
    const tick = (): void => {
      if (game.loop.time - start >= ms) {
        game.events.off("step", tick);
        resolve();
      }
    };
    game.events.on("step", tick);
  });
}

export function markE2EAssetsLoaded(game: Phaser.Game): void {
  if (!isE2EEnabled()) return;
  const keys = COMBAT_FX_ASSETS.map((a) => a.key);
  const ok = keys.every((k) => game.textures.exists(k));
  publishE2E({ assetsLoaded: ok, flags: { combatFxKeys: keys.join(",") } });
}