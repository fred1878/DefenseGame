import Phaser from "phaser";
import { GAME } from "../config";
import type { SaveGame } from "../core/saveTypes";
import { COMBAT_FX_ASSETS, SPELL_FX_ASSETS } from "../content/assets";
import { setShowTouchInput } from "../debug/DebugState";
import { persistSave } from "../core/GameState";
import type { DefenseScene } from "../scenes/DefenseScene";
import type { TownScene } from "../scenes/TownScene";
import { isE2EEnabled } from "./e2eMode";
import {
  defaultE2EState,
  getE2EState,
  publishE2E,
  type DefenseGameE2EApi,
} from "./e2eGlobal";

const DOM_MIRROR_IDS = [
  "start-night",
  "combat-atk",
  "combat-mode",
  "combat-auto",
  "spell-slot-0",
  "spell-slot-1",
  "spell-slot-2",
  "spell-slot-3",
  "spell-slot-4",
  "spell-slot-5",
  "defense-return-to-town",
] as const;

function ensureDomMirrorButton(
  host: HTMLElement,
  testId: string,
  onClick: () => void,
): HTMLButtonElement {
  let btn = host.querySelector<HTMLButtonElement>(
    `[data-testid="${testId}"]`,
  );
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-testid", testId);
    btn.textContent = testId;
    btn.style.cssText =
      "position:fixed;width:44px;height:44px;opacity:0.01;pointer-events:auto;z-index:99999";
    host.appendChild(btn);
    btn.addEventListener("click", onClick);
  }
  return btn;
}

function ensureDomTestActions(api: DefenseGameE2EApi): void {
  if (!isE2EEnabled() || typeof document === "undefined") return;
  let host = document.getElementById("defensegame-e2e-dom");
  if (!host) {
    host = document.createElement("div");
    host.id = "defensegame-e2e-dom";
    host.setAttribute("data-testid", "e2e-dom-root");
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99998";
    document.body.appendChild(host);
  }
  ensureDomMirrorButton(host, "start-night", () => api.startNight());
  for (const id of DOM_MIRROR_IDS) {
    if (id === "start-night") continue;
    ensureDomMirrorButton(host, id, () => api.tapDomMirror(id));
  }
}

function canvasGameToPage(
  gameX: number,
  gameY: number,
): { left: number; top: number } | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#game canvas");
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width / GAME.width;
  const sy = rect.height / GAME.height;
  return {
    left: rect.left + gameX * sx,
    top: rect.top + gameY * sy,
  };
}

function positionDomMirrors(
  targets: Record<string, { x: number; y: number }>,
): void {
  if (!isE2EEnabled() || typeof document === "undefined") return;
  const host = document.getElementById("defensegame-e2e-dom");
  if (!host) return;
  for (const [testId, pt] of Object.entries(targets)) {
    const btn = host.querySelector<HTMLButtonElement>(
      `[data-testid="${testId}"]`,
    );
    if (!btn) continue;
    const pagePt = canvasGameToPage(pt.x, pt.y);
    if (!pagePt) continue;
    btn.style.left = `${pagePt.left - 22}px`;
    btn.style.top = `${pagePt.top - 22}px`;
    btn.style.display = "block";
  }
  for (const id of DOM_MIRROR_IDS) {
    if (targets[id]) continue;
    const btn = host.querySelector<HTMLButtonElement>(
      `[data-testid="${id}"]`,
    );
    if (btn && id !== "start-night") btn.style.display = "none";
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

function buildApi(game: Phaser.Game): DefenseGameE2EApi {
  return {
    startNight() {
      const town = game.scene.getScene("Town") as TownScene | null;
      if (town?.scene.isActive()) {
        town.e2eStartNight();
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
    getEnemyCount() {
      return activeDefense(game)?.e2eEnemyCount() ?? 0;
    },
    setManualReturnToTown(on: boolean) {
      game.registry.set("e2eManualReturn", on);
      activeDefense(game)?.e2eSetManualReturn(on);
    },
    nightEnded() {
      return activeDefense(game)?.e2eNightEnded() ?? false;
    },
    hasReturnButton() {
      return activeDefense(game)?.e2eHasReturnButton() ?? false;
    },
    getUiTapTargets() {
      const defense = activeDefense(game);
      if (defense) return defense.e2eGetUiTapTargets();
      const town = game.scene.getScene("Town") as TownScene | null;
      if (town?.scene.isActive()) return town.e2eGetUiTapTargets();
      return {};
    },
    isUiButtonPressed(testId: string) {
      const defense = activeDefense(game);
      if (defense) return defense.e2eIsTouchButtonPressed(testId);
      const town = game.scene.getScene("Town") as TownScene | null;
      if (town?.scene.isActive()) return town.e2eIsTouchButtonPressed(testId);
      return false;
    },
    getAutoAttackEnabled() {
      return activeDefense(game)?.e2eAutoAttackEnabled() ?? false;
    },
    syncDomMirrors() {
      const defense = activeDefense(game);
      if (defense) {
        positionDomMirrors(defense.e2eGetUiTapTargets());
        return;
      }
      const town = game.scene.getScene("Town") as TownScene | null;
      if (town?.scene.isActive()) {
        positionDomMirrors(town.e2eGetUiTapTargets());
      }
    },
    tapDomMirror(testId: string) {
      const defense = activeDefense(game);
      if (!defense) return;
      const targets = defense.e2eGetUiTapTargets();
      const pt = targets[testId];
      if (!pt) return;
      defense.e2eSimulateScreenTap(pt.x, pt.y);
    },
    simulateScreenTap(x: number, y: number) {
      activeDefense(game)?.e2eSimulateScreenTap(x, y);
    },
    getDefenseWallHp() {
      return activeDefense(game)?.e2eWallHp() ?? 0;
    },
    e2eBottomChromeTextureKey() {
      return activeDefense(game)?.e2eBottomChromeTextureKey() ?? null;
    },
    setSpawnPlanComplete() {
      activeDefense(game)?.e2eSetSpawnPlanComplete();
    },
    setPlayerPosition(x: number, y: number) {
      activeDefense(game)?.e2eSetPlayerPosition(x, y);
    },
    getDefenseCameraScroll() {
      return (
        activeDefense(game)?.e2eGetDefenseCameraScroll() ?? { x: 0, y: 0 }
      );
    },
    setShowEnemyPaths(on: boolean) {
      activeDefense(game)?.e2eSetShowEnemyPaths(on);
    },
    setShowTouchInput(on: boolean) {
      setShowTouchInput(game.registry, on);
    },
    getTownBuildingDebugRectCount(): number {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive() ? town.e2eTownBuildingDebugRectCount() : 0;
    },
    getObstacleAlignment() {
      return activeDefense(game)?.e2eGetObstacleAlignment() ?? [];
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
  const keys = [
    ...COMBAT_FX_ASSETS.map((a) => a.key),
    ...SPELL_FX_ASSETS.map((a) => a.key),
  ];
  const ok = keys.every((k) => game.textures.exists(k));
  publishE2E({ assetsLoaded: ok, flags: { combatFxKeys: keys.join(",") } });
}