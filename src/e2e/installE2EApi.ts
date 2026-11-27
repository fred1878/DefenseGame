import { playerTuning } from "../config/player";
import type Phaser from "phaser";
import { SPELL_BAR, type AttackMode } from "../config";
import { applyPlayerTuning } from "../config/player";
import { defenseHalfHeight, defenseHalfWidth } from "../config/defense";
import type { SaveGame } from "../core/save/saveTypes";
import { spellIconTextureKey } from "../content/assets";
import { setShowHitboxes, setShowTouchInput } from "../debug/DebugState";
import {
  mergePlayerWithoutLegacyMoveSpeed,
  type LegacySavePlayer,
} from "../core/save/GameState";
import { persistSave } from "../core/save/saveRepository";
import type { DefenseScene } from "../scenes/DefenseScene";
import type { TownScene } from "../scenes/TownScene";
import {
  dismissTownSetupScenes,
  isAnyTownSetupSceneActive,
  TOWN_ENDLESS_SETUP_SCENE_KEY,
  TOWN_WAVE_PLANNER_SETUP_SCENE_KEY,
} from "../scenes/town/townSetupSceneLifecycle";
import { activeTownUiHost, activeEndlessSetupScene } from "./townUiHost";
import { getE2EState, publishE2E, type DefenseGameE2EApi } from "./e2eGlobal";
import { castTally, combatTally, resetCombatTally } from "./combatTally";
import { startFixedStep, stepGame, stopFixedStep } from "./fixedStep";
import { peekDataStore, peekSave, setSave } from "../core/registryKeys";

/** `window.__DEFENSEGAME_E2E__.api` implementation (Town + Defense hooks). */
export function buildApi(game: Phaser.Game): DefenseGameE2EApi {
  return {
    startNight() {
      dismissTownSetupScenes(game);
      const town = townForE2E(game);
      if (town && (town.scene.isActive() || town.scene.isPaused?.() === true)) {
        town.e2eStartNight();
        return;
      }
      game.scene.start("Defense");
    },
    async setStick(dx, dy, ms = 0) {
      const defense = activeDefense(game);
      if (!defense) return;
      e2eOf(defense).setStick(dx, dy);
      if (ms <= 0) return;
      await waitGameMs(game, ms);
      e2eOf(defense).setStick(0, 0);
    },
    clearStick() {
      activeDefenseE2e(game)?.setStick(0, 0);
    },
    tapMelee() {
      activeDefenseE2e(game)?.tapMelee();
    },
    tapRanged() {
      activeDefenseE2e(game)?.tapRanged();
    },
    async castSpell(slot: number) {
      const defense = activeDefense(game);
      if (!defense) return;
      await e2eOf(defense).castSpellSlot(slot);
    },
    getSave() {
      const save = peekSave(game.registry);
      return save ? structuredClone(save) : null;
    },
    setSave(partial: Partial<SaveGame>) {
      const cur = peekSave(game.registry);
      if (!cur) return;
      const next = structuredClone({
        ...cur,
        ...partial,
        player: mergePlayerWithoutLegacyMoveSpeed(
          cur.player,
          partial.player as LegacySavePlayer | undefined,
        ),
        buildings: { ...cur.buildings, ...partial.buildings },
        spellBar: partial.spellBar ?? cur.spellBar,
        flags: partial.flags ?? cur.flags,
      });
      setSave(game.registry, next);
      persistSave(next);
    },
    setPlayerMoveSpeedWu(moveSpeedWu: number) {
      applyPlayerTuning({ ...playerTuning(), moveSpeedWu });
    },
    spawnTestEnemy(x = 80, y = 0) {
      activeDefenseE2e(game)?.spawnEnemy(x, y);
    },
    spawnTestEnemyByDef(defId: string, offX = 56, offY = 0) {
      const defense = activeDefense(game);
      if (!defense) return;
      const pos = e2eOf(defense).playerPosition();
      defense.spawnEnemyAt(pos.x + offX, pos.y + offY, undefined, defId, 999);
    },
    setGodMode(on: boolean) {
      game.registry.set("e2eGodMode", on);
      getE2EState().flags.godMode = on;
    },
    damagePlayer(amount: number) {
      activeDefenseE2e(game)?.damagePlayer(amount);
    },
    killAllEnemies() {
      activeDefenseE2e(game)?.killAllEnemies();
    },
    forceWinNight() {
      activeDefenseE2e(game)?.forceWinNight();
    },
    textureLoaded(key: string) {
      return game.textures.exists(key);
    },
    auditSpellBarTextures() {
      const save = peekSave(game.registry);
      const slots = save?.spellBar?.slots ?? [];
      const out: ReturnType<DefenseGameE2EApi["auditSpellBarTextures"]> = [];
      for (let slot = 0; slot < SPELL_BAR.slotCount; slot++) {
        const spellId = slots[slot] ?? "";
        const key = spellId ? spellIconTextureKey(spellId) : "";
        if (!key) {
          out.push({
            slot,
            spellId: "",
            key: "",
            loaded: false,
            width: 0,
            height: 0,
          });
          continue;
        }
        const loaded = game.textures.exists(key);
        if (!loaded) {
          out.push({ slot, spellId, key, loaded: false, width: 0, height: 0 });
          continue;
        }
        const tex = game.textures.get(key);
        const frame = tex.get();
        out.push({
          slot,
          spellId,
          key,
          loaded: true,
          width: frame.width,
          height: frame.height,
        });
      }
      return out;
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
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    },
    startFixedStep(stepMs, seed, renderEvery = 0) {
      startFixedStep(game, stepMs, seed, renderEvery);
    },
    stepGame(frames) {
      return stepGame(game, frames);
    },
    stopFixedStep() {
      stopFixedStep(game);
    },
    getAttackPhase() {
      return activeDefenseE2e(game)?.attackPhase() ?? "idle";
    },
    getProjectileCount() {
      return activeDefenseE2e(game)?.projectileCount() ?? 0;
    },
    getAttackMode() {
      return activeDefenseE2e(game)?.attackMode() ?? null;
    },
    getLivingEnemyHps() {
      return activeDefenseE2e(game)?.livingEnemyHps() ?? [];
    },
    setAttackMode(mode: AttackMode) {
      activeDefenseE2e(game)?.setAttackMode(mode);
    },
    getLivingEnemyPositions() {
      return activeDefenseE2e(game)?.livingEnemyPositions() ?? [];
    },
    getCombatTally() {
      return combatTally();
    },
    getCastTally() {
      return castTally();
    },
    getSpellCastState() {
      return (
        activeDefenseE2e(game)?.spellCastState() ?? {
          activeSpellId: null,
          phase: null,
          readyWindupSpellIds: [],
        }
      );
    },
    resetCombatTally() {
      resetCombatTally();
    },
    getEnemyCount() {
      return activeDefenseE2e(game)?.enemyCount() ?? 0;
    },
    setManualReturnToTown(on: boolean) {
      game.registry.set("e2eManualReturn", on);
      activeDefenseE2e(game)?.setManualReturn(on);
    },
    nightEnded() {
      return activeDefenseE2e(game)?.nightEnded() ?? false;
    },
    hasReturnButton() {
      return activeDefenseE2e(game)?.hasReturnButton() ?? false;
    },
    returnToTown() {
      activeDefense(game)?.e2eReturnToTown();
    },
    getUiTapTargets() {
      const defense = activeDefense(game);
      if (defense) return e2eOf(defense).getUiTapTargets();
      const town = activeTownUiHost(game);
      return town?.e2eGetUiTapTargets() ?? {};
    },
    getSpellSlotHitRects() {
      return activeDefenseE2e(game)?.getSpellSlotHitRects() ?? [];
    },
    isUiButtonPressed(testId: string) {
      const defense = activeDefense(game);
      if (defense) return e2eOf(defense).isTouchButtonPressed(testId);
      const town = activeTownUiHost(game) as TownScene | null;
      if (town?.scene.isActive()) return town.e2eIsTouchButtonPressed(testId);
      return false;
    },
    getAutoAttackEnabled() {
      return activeDefenseE2e(game)?.autoAttackEnabled() ?? false;
    },
    setAutoAttackEnabled(on: boolean) {
      activeDefenseE2e(game)?.setAutoAttackEnabled(on);
    },
    getDefenseWallHp() {
      return activeDefenseE2e(game)?.wallHp() ?? 0;
    },
    e2eBottomChromeTextureKey() {
      return activeDefenseE2e(game)?.bottomChromeTextureKey() ?? null;
    },
    setSpawnPlanComplete() {
      activeDefenseE2e(game)?.setSpawnPlanComplete();
    },
    setPlayerPosition(x: number, y: number) {
      activeDefenseE2e(game)?.setPlayerPosition(x, y);
    },
    getPlayerPosition() {
      return activeDefenseE2e(game)?.playerPosition() ?? { x: 0, y: 0 };
    },
    getObstacleBlockerAabb(index: number) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return e2eOf(scene).obstacleBlockerAabb(index);
    },
    getObstacleArcadeBodyAabb(index: number) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return e2eOf(scene).obstacleArcadeBodyAabb(index);
    },
    getPlayerBodyRadius() {
      return activeDefenseE2e(game)?.playerBodyRadius() ?? 0;
    },
    getMaxPlayerObstacleOverlapPx(obstacleIndex?: number) {
      return (
        activeDefenseE2e(game)?.maxPlayerObstacleOverlapPx(obstacleIndex) ?? 0
      );
    },
    centerDefenseCameraOn(worldX: number, worldY: number) {
      activeDefenseE2e(game)?.centerCameraOn(worldX, worldY);
    },
    getObstacleBumpProbe(obstacleIndex, approach) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return e2eOf(scene).obstacleBumpProbe(obstacleIndex, approach);
    },
    getFlushTangentPosition(obstacleIndex, approach, beyondPx) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return e2eOf(scene).flushTangentPosition(
        obstacleIndex,
        approach,
        beyondPx,
      );
    },
    resolvePlayerObstacleOverlap() {
      activeDefenseE2e(game)?.resolvePlayerObstacleOverlap();
    },
    getDefenseCameraScroll() {
      return activeDefenseE2e(game)?.getDefenseCameraScroll() ?? { x: 0, y: 0 };
    },
    getDefenseHalfHeight() {
      return defenseHalfHeight();
    },
    getDefenseHalfWidth() {
      return defenseHalfWidth();
    },
    getDefenseHudLayoutProbe() {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return e2eOf(scene).hudLayoutProbe();
    },
    worldPointToDefenseScreen(worldX: number, worldY: number) {
      return (
        activeDefenseE2e(game)?.worldPointToScreen(worldX, worldY) ?? {
          x: 0,
          y: 0,
        }
      );
    },
    async sampleDefenseHudBandPixelsAsync() {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return e2eOf(scene).sampleHudBandPixelsAsync();
    },
    setShowEnemyPaths(on: boolean) {
      activeDefenseE2e(game)?.setShowEnemyPaths(on);
    },
    setShowHitboxes(on: boolean) {
      const scene = activeDefense(game);
      if (!scene) return;
      setShowHitboxes(scene.registry, on);
    },
    setShowTouchInput(on: boolean) {
      setShowTouchInput(game.registry, on);
    },
    getTownBuildingDebugRectCount(): number {
      const town = game.scene.getScene("Town") as TownScene | null;
      if (!town?.scene.isActive()) return 0;
      if (isAnyTownSetupSceneActive(game)) return 0;
      return town.e2eTownBuildingDebugRectCount();
    },
    getTownTouchDebugRectCount(): number {
      const host = activeTownUiHost(game);
      if (!host) return 0;
      if (host.scene.key === TOWN_ENDLESS_SETUP_SCENE_KEY) {
        return (
          host as import("../scenes/EndlessModeSetupScene").EndlessModeSetupScene
        ).e2eTouchDebugRectCount();
      }
      if (host.scene.key === TOWN_WAVE_PLANNER_SETUP_SCENE_KEY) {
        return (
          host as import("../scenes/WavePlannerSetupScene").WavePlannerSetupScene
        ).e2eTouchDebugRectCount();
      }
      return (host as TownScene).e2eTownTouchDebugRectCount();
    },
    openSpellSortPanel() {
      const town = game.scene.getScene("Town") as TownScene | null;
      town?.e2eOpenSpellSortPanel();
    },
    isSpellSortPanelOpen() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive() ? town.e2eIsSpellSortPanelOpen() : false;
    },
    getSpellSortSlotHitRects() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive() ? town.e2eGetSpellSortSlotHitRects() : [];
    },
    getSpellSortBarSlots() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive() ? town.e2eGetSpellSortBarSlots() : [];
    },
    openEndlessPanel() {
      townForE2E(game)?.e2eOpenEndlessPanel();
    },
    isEndlessPanelOpen() {
      return activeEndlessSetupScene(game)?.e2eIsOpen() ?? false;
    },
    startEndless(enemyId: string, infiniteHp = false) {
      const setup = activeEndlessSetupScene(game);
      if (setup) setup.e2eStartEndless(enemyId, infiniteHp);
      else townForE2E(game)?.e2eStartEndless(enemyId, infiniteHp);
    },
    getEndlessPanelDefaultConcurrent() {
      const store = peekDataStore(game.registry);
      return store?.player.endlessPanelDefaultConcurrent ?? 1;
    },
    setEndlessInfiniteHp(enabled: boolean) {
      activeEndlessSetupScene(game)?.e2eSetEndlessInfiniteHp(enabled);
    },
    getEndlessInfiniteHp() {
      return (
        activeEndlessSetupScene(game)?.e2eEndlessInfiniteHpEnabled() ?? false
      );
    },
    isEndlessInfiniteHp() {
      return activeDefenseE2e(game)?.isEndlessInfiniteHp() ?? false;
    },
    getPlayerHp() {
      const defense = activeDefense(game);
      if (defense) return e2eOf(defense).playerHp();
      const town = game.scene.getScene("Town") as TownScene | null;
      if (!town?.scene.isActive()) return 0;
      const save = peekSave(game.registry);
      return Math.floor(save?.player?.hp ?? 0);
    },
    scrollEndlessEnemyList(deltaY: number) {
      activeEndlessSetupScene(game)?.e2eScrollEndlessEnemyList(deltaY);
    },
    getEndlessEnemyListScrollState() {
      return (
        activeEndlessSetupScene(game)?.e2eEndlessEnemyListScrollState() ?? null
      );
    },
    getEndlessSelectedEnemyId() {
      return activeEndlessSetupScene(game)?.e2eEndlessSelectedEnemyId() ?? null;
    },
    getEndlessSelectedEnemyIds() {
      return activeEndlessSetupScene(game)?.e2eEndlessSelectedEnemyIds() ?? [];
    },
    getEndlessRosterEnemyIds() {
      return activeEndlessSetupScene(game)?.e2eEndlessRosterEnemyIds() ?? [];
    },
    getEndlessEnemyConcurrentCap(enemyId: string) {
      return (
        activeEndlessSetupScene(game)?.e2eEndlessEnemyConcurrentCap(enemyId) ??
        null
      );
    },
    toggleEndlessEnemy(enemyId: string) {
      activeEndlessSetupScene(game)?.e2eToggleEndlessEnemy(enemyId);
    },
    setEndlessEnemyCap(enemyId: string, cap: number) {
      activeEndlessSetupScene(game)?.e2eSetEndlessEnemyCap(enemyId, cap);
    },
    isEndlessDefense() {
      return activeDefenseE2e(game)?.isEndlessMode() ?? false;
    },
    isWavePlannerDefense() {
      return activeDefense(game)?.isWavePlannerMode() ?? false;
    },
    getLivingEnemyDefIds() {
      return activeDefenseE2e(game)?.livingEnemyDefIds() ?? [];
    },
    getEndlessEnemyId() {
      return activeDefenseE2e(game)?.endlessEnemyId() ?? null;
    },
    getEndlessEnemyIds() {
      return activeDefenseE2e(game)?.endlessEnemyIds() ?? [];
    },
    hasLeaveEndlessButton() {
      return activeDefenseE2e(game)?.hasLeaveEndlessButton() ?? false;
    },
    canFocusFirstLivingEnemy() {
      return activeDefenseE2e(game)?.canFocusFirstLivingEnemy() ?? false;
    },
    damageFirstLivingEnemy(amount: number) {
      activeDefenseE2e(game)?.damageFirstLivingEnemy(amount);
    },
    previewHolyFx(kind: "flash" | "channel") {
      activeDefenseE2e(game)?.previewHolyFx(kind);
    },
    showcaseEnemyMeleeSwipe(defId: string, offX: number) {
      const defense = activeDefense(game);
      if (!defense) return;
      const result = e2eOf(defense).showcaseEnemyMeleeSwipe(defId, offX);
      publishE2E({
        flags: {
          lastEnemyMeleeFxSide: result.side,
        },
      });
    },
    previewEnemyMeleeFx(enemyDefId: string, offX = 52) {
      const defense = activeDefense(game);
      if (!defense) return;
      const result = e2eOf(defense).previewEnemyMeleeFx(enemyDefId, offX);
      publishE2E({
        flags: {
          lastEnemyMeleeFxSide: result.side,
        },
      });
    },
    clearEnemyMeleeFxFlag() {
      publishE2E({
        flags: {
          enemyMeleeFxSpawned: 0,
          lastEnemyMeleeFxDef: "",
          lastEnemyMeleeFxFacing: 0,
          lastEnemyMeleeFxRot: 0,
          lastEnemyMeleeFxFlipX: 0,
          lastEnemyMeleeFxSide: "",
        },
      });
    },
  };
}

function activeDefense(game: Phaser.Game): DefenseScene | null {
  const defense = game.scene.getScene("Defense") as DefenseScene | null;
  return defense?.scene.isActive() ? defense : null;
}

/** Town scene instance for e2e hooks (present under setup overlays; may be paused). */
function townForE2E(game: Phaser.Game): TownScene | null {
  return game.scene.getScene("Town") as TownScene | null;
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

function e2eOf(defense: DefenseScene) {
  const host = defense.e2e;
  if (!host) throw new Error("DefenseScene E2E host not registered");
  return host;
}

function activeDefenseE2e(game: Phaser.Game) {
  return activeDefense(game)?.e2e ?? null;
}
