import type Phaser from "phaser";
import { PLAYER_TUNING, SPELL_BAR } from "../config";
import { applyPlayerTuning } from "../config/player";
import { defenseHalfHeight, defenseHalfWidth } from "../config/defense";
import type { SaveGame } from "../core/saveTypes";
import type { DataStore } from "../core/DataStore";
import { spellIconTextureKey } from "../content/assets";
import { setShowHitboxes, setShowTouchInput } from "../debug/DebugState";
import {
  mergePlayerWithoutLegacyMoveSpeed,
  persistSave,
  type LegacySavePlayer,
} from "../core/GameState";
import type { DefenseScene } from "../scenes/DefenseScene";
import type { TownScene } from "../scenes/TownScene";
import {
  isAnyTownSetupSceneActive,
  TOWN_ENDLESS_SETUP_SCENE_KEY,
  TOWN_WAVE_PLANNER_SETUP_SCENE_KEY,
} from "../scenes/town/townSetupSceneLifecycle";
import { activeTownUiHost } from "./townUiHost";
import { getE2EState, publishE2E, type DefenseGameE2EApi } from "./e2eGlobal";
import { positionDomMirrors } from "./installE2EDom";

/** `window.__DEFENSEGAME_E2E__.api` implementation (Town + Defense hooks). */
export function buildApi(game: Phaser.Game): DefenseGameE2EApi {
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
      defense.e2e.setStick(dx, dy);
      if (ms <= 0) return;
      await waitGameMs(game, ms);
      defense.e2e.setStick(0, 0);
    },
    clearStick() {
      activeDefense(game)?.e2e.setStick(0, 0);
    },
    tapMelee() {
      activeDefense(game)?.e2e.tapMelee();
    },
    tapRanged() {
      activeDefense(game)?.e2e.tapRanged();
    },
    async castSpell(slot: number) {
      const defense = activeDefense(game);
      if (!defense) return;
      await defense.e2e.castSpellSlot(slot);
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
        player: mergePlayerWithoutLegacyMoveSpeed(
          cur.player,
          partial.player as LegacySavePlayer | undefined,
        ),
        buildings: { ...cur.buildings, ...partial.buildings },
        spellBar: partial.spellBar ?? cur.spellBar,
        flags: partial.flags ?? cur.flags,
      });
      game.registry.set("save", next);
      persistSave(next);
    },
    setPlayerMoveSpeedWu(moveSpeedWu: number) {
      applyPlayerTuning({ ...PLAYER_TUNING, moveSpeedWu });
    },
    spawnTestEnemy(x = 80, y = 0) {
      activeDefense(game)?.e2e.spawnEnemy(x, y);
    },
    spawnTestEnemyByDef(defId: string, offX = 56, offY = 0) {
      const defense = activeDefense(game);
      if (!defense) return;
      const pos = defense.e2e.playerPosition();
      defense.spawnEnemyAt(pos.x + offX, pos.y + offY, undefined, defId, 999);
    },
    setGodMode(on: boolean) {
      game.registry.set("e2eGodMode", on);
      getE2EState().flags.godMode = on;
    },
    damagePlayer(amount: number) {
      activeDefense(game)?.e2e.damagePlayer(amount);
    },
    killAllEnemies() {
      activeDefense(game)?.e2e.killAllEnemies();
    },
    forceWinNight() {
      activeDefense(game)?.e2e.forceWinNight();
    },
    textureLoaded(key: string) {
      return game.textures.exists(key);
    },
    auditSpellBarTextures() {
      const save = game.registry.get("save") as SaveGame | undefined;
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
    getAttackPhase() {
      return activeDefense(game)?.e2e.attackPhase() ?? "idle";
    },
    getProjectileCount() {
      return activeDefense(game)?.e2e.projectileCount() ?? 0;
    },
    getAttackMode() {
      return activeDefense(game)?.e2e.attackMode() ?? null;
    },
    getLivingEnemyHps() {
      return activeDefense(game)?.e2e.livingEnemyHps() ?? [];
    },
    getEnemyCount() {
      return activeDefense(game)?.e2e.enemyCount() ?? 0;
    },
    setManualReturnToTown(on: boolean) {
      game.registry.set("e2eManualReturn", on);
      activeDefense(game)?.e2e.setManualReturn(on);
    },
    nightEnded() {
      return activeDefense(game)?.e2e.nightEnded() ?? false;
    },
    hasReturnButton() {
      return activeDefense(game)?.e2e.hasReturnButton() ?? false;
    },
    returnToTown() {
      activeDefense(game)?.e2eReturnToTown();
    },
    getUiTapTargets() {
      const defense = activeDefense(game);
      if (defense) return defense.e2e.getUiTapTargets();
      const town = activeTownUiHost(game);
      return town?.e2eGetUiTapTargets() ?? {};
    },
    getSpellSlotHitRects() {
      return activeDefense(game)?.e2e.getSpellSlotHitRects() ?? [];
    },
    isUiButtonPressed(testId: string) {
      const defense = activeDefense(game);
      if (defense) return defense.e2e.isTouchButtonPressed(testId);
      const town = activeTownUiHost(game) as TownScene | null;
      if (town?.scene.isActive()) return town.e2eIsTouchButtonPressed(testId);
      return false;
    },
    getAutoAttackEnabled() {
      return activeDefense(game)?.e2e.autoAttackEnabled() ?? false;
    },
    syncDomMirrors() {
      const defense = activeDefense(game);
      if (defense) {
        positionDomMirrors(defense.e2e.getUiTapTargets());
        return;
      }
      const town = activeTownUiHost(game);
      if (town) {
        positionDomMirrors(town.e2eGetUiTapTargets());
      }
    },
    tapDomMirror(testId: string) {
      const defense = activeDefense(game);
      if (!defense) return;
      const targets = defense.e2e.getUiTapTargets();
      const pt = targets[testId];
      if (!pt) return;
      defense.e2e.simulateScreenTap(pt.x, pt.y);
    },
    simulateScreenTap(x: number, y: number) {
      activeDefense(game)?.e2e.simulateScreenTap(x, y);
    },
    getDefenseWallHp() {
      return activeDefense(game)?.e2e.wallHp() ?? 0;
    },
    e2eBottomChromeTextureKey() {
      return activeDefense(game)?.e2e.bottomChromeTextureKey() ?? null;
    },
    setSpawnPlanComplete() {
      activeDefense(game)?.e2e.setSpawnPlanComplete();
    },
    setPlayerPosition(x: number, y: number) {
      activeDefense(game)?.e2e.setPlayerPosition(x, y);
    },
    getPlayerPosition() {
      return activeDefense(game)?.e2e.playerPosition() ?? { x: 0, y: 0 };
    },
    getObstacleBlockerAabb(index: number) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2e.obstacleBlockerAabb(index);
    },
    getObstacleArcadeBodyAabb(index: number) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2e.obstacleArcadeBodyAabb(index);
    },
    getPlayerBodyRadius() {
      return activeDefense(game)?.e2e.playerBodyRadius() ?? 0;
    },
    getMaxPlayerObstacleOverlapPx(obstacleIndex?: number) {
      return (
        activeDefense(game)?.e2e.maxPlayerObstacleOverlapPx(obstacleIndex) ?? 0
      );
    },
    centerDefenseCameraOn(worldX: number, worldY: number) {
      activeDefense(game)?.e2e.centerCameraOn(worldX, worldY);
    },
    getObstacleBumpProbe(obstacleIndex, approach) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2e.obstacleBumpProbe(obstacleIndex, approach);
    },
    getFlushTangentPosition(obstacleIndex, approach, beyondPx) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2e.flushTangentPosition(obstacleIndex, approach, beyondPx);
    },
    resolvePlayerObstacleOverlap() {
      activeDefense(game)?.e2e.resolvePlayerObstacleOverlap();
    },
    getDefenseCameraScroll() {
      return (
        activeDefense(game)?.e2e.getDefenseCameraScroll() ?? { x: 0, y: 0 }
      );
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
      return scene.e2e.hudLayoutProbe();
    },
    worldPointToDefenseScreen(worldX: number, worldY: number) {
      return (
        activeDefense(game)?.e2e.worldPointToScreen(worldX, worldY) ?? {
          x: 0,
          y: 0,
        }
      );
    },
    async sampleDefenseHudBandPixelsAsync() {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2e.sampleHudBandPixelsAsync();
    },
    setShowEnemyPaths(on: boolean) {
      activeDefense(game)?.e2e.setShowEnemyPaths(on);
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
      return townUiForE2E(game)?.e2eIsEndlessPanelOpen() ?? false;
    },
    startEndless(enemyId: string, infiniteHp = false) {
      townForE2E(game)?.e2eStartEndless(enemyId, infiniteHp);
    },
    getEndlessPanelDefaultConcurrent() {
      const store = game.registry.get("dataStore") as DataStore | undefined;
      return store?.player.endlessPanelDefaultConcurrent ?? 1;
    },
    setEndlessInfiniteHp(enabled: boolean) {
      townForE2E(game)?.e2eSetEndlessInfiniteHp(enabled);
    },
    getEndlessInfiniteHp() {
      return townUiForE2E(game)?.e2eEndlessInfiniteHpEnabled() ?? false;
    },
    isEndlessInfiniteHp() {
      return activeDefense(game)?.e2e.isEndlessInfiniteHp() ?? false;
    },
    getPlayerHp() {
      const defense = activeDefense(game);
      if (defense) return defense.e2e.playerHp();
      const town = game.scene.getScene("Town") as TownScene | null;
      if (!town?.scene.isActive()) return 0;
      const save = game.registry.get("save") as { player?: { hp?: number } };
      return Math.floor(save?.player?.hp ?? 0);
    },
    scrollEndlessEnemyList(deltaY: number) {
      townForE2E(game)?.e2eScrollEndlessEnemyList(deltaY);
    },
    getEndlessEnemyListScrollState() {
      return townUiForE2E(game)?.e2eEndlessEnemyListScrollState() ?? null;
    },
    getEndlessSelectedEnemyId() {
      return townUiForE2E(game)?.e2eEndlessSelectedEnemyId() ?? null;
    },
    getEndlessSelectedEnemyIds() {
      return townUiForE2E(game)?.e2eEndlessSelectedEnemyIds() ?? [];
    },
    getEndlessRosterEnemyIds() {
      return townUiForE2E(game)?.e2eEndlessRosterEnemyIds() ?? [];
    },
    getEndlessEnemyConcurrentCap(enemyId: string) {
      return townUiForE2E(game)?.e2eEndlessEnemyConcurrentCap(enemyId) ?? null;
    },
    toggleEndlessEnemy(enemyId: string) {
      townForE2E(game)?.e2eToggleEndlessEnemy(enemyId);
    },
    setEndlessEnemyCap(enemyId: string, cap: number) {
      townForE2E(game)?.e2eSetEndlessEnemyCap(enemyId, cap);
    },
    isEndlessDefense() {
      return activeDefense(game)?.e2e.isEndlessMode() ?? false;
    },
    isWavePlannerDefense() {
      return activeDefense(game)?.isWavePlannerMode() ?? false;
    },
    getLivingEnemyDefIds() {
      return activeDefense(game)?.e2e.livingEnemyDefIds() ?? [];
    },
    getEndlessEnemyId() {
      return activeDefense(game)?.e2e.endlessEnemyId() ?? null;
    },
    getEndlessEnemyIds() {
      return activeDefense(game)?.e2e.endlessEnemyIds() ?? [];
    },
    hasLeaveEndlessButton() {
      return activeDefense(game)?.e2e.hasLeaveEndlessButton() ?? false;
    },
    canFocusFirstLivingEnemy() {
      return activeDefense(game)?.e2e.canFocusFirstLivingEnemy() ?? false;
    },
    damageFirstLivingEnemy(amount: number) {
      activeDefense(game)?.e2e.damageFirstLivingEnemy(amount);
    },
    previewHolyFx(kind: "flash" | "channel") {
      activeDefense(game)?.e2e.previewHolyFx(kind);
    },
    showcaseEnemyMeleeSwipe(defId: string, offX: number) {
      const defense = activeDefense(game);
      if (!defense) return;
      const result = defense.e2e.showcaseEnemyMeleeSwipe(defId, offX);
      publishE2E({
        flags: {
          lastEnemyMeleeFxSide: result.side,
        },
      });
    },
    previewEnemyMeleeFx(enemyDefId: string, offX = 52) {
      const defense = activeDefense(game);
      if (!defense) return;
      const result = defense.e2e.previewEnemyMeleeFx(enemyDefId, offX);
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

/** Town hooks only when the UI stack is Town or a Town setup scene. */
function townUiForE2E(game: Phaser.Game): TownScene | null {
  const town = townForE2E(game);
  if (!town) return null;
  return activeTownUiHost(game) ? town : null;
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
