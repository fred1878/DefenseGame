import Phaser from "phaser";
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
      activeDefense(game)?.e2eSpawnEnemy(x, y);
    },
    spawnTestEnemyByDef(defId: string, offX = 56, offY = 0) {
      const defense = activeDefense(game);
      if (!defense) return;
      const pos = defense.e2ePlayerPosition();
      defense.spawnEnemyAt(
        pos.x + offX,
        pos.y + offY,
        undefined,
        defId,
        999,
      );
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
    returnToTown() {
      activeDefense(game)?.e2eReturnToTown();
    },
    getUiTapTargets() {
      const defense = activeDefense(game);
      if (defense) return defense.e2eGetUiTapTargets();
      const town = game.scene.getScene("Town") as TownScene | null;
      if (town?.scene.isActive()) return town.e2eGetUiTapTargets();
      return {};
    },
    getSpellSlotHitRects() {
      return activeDefense(game)?.e2eGetSpellSlotHitRects() ?? [];
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
    getPlayerPosition() {
      return activeDefense(game)?.e2ePlayerPosition() ?? { x: 0, y: 0 };
    },
    getObstacleBlockerAabb(index: number) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2eObstacleBlockerAabb(index);
    },
    getObstacleArcadeBodyAabb(index: number) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2eObstacleArcadeBodyAabb(index);
    },
    getPlayerBodyRadius() {
      return activeDefense(game)?.e2ePlayerBodyRadius() ?? 0;
    },
    getMaxPlayerObstacleOverlapPx(obstacleIndex?: number) {
      return activeDefense(game)?.e2eMaxPlayerObstacleOverlapPx(obstacleIndex) ?? 0;
    },
    centerDefenseCameraOn(worldX: number, worldY: number) {
      activeDefense(game)?.e2eCenterCameraOn(worldX, worldY);
    },
    getObstacleBumpProbe(obstacleIndex, approach) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2eObstacleBumpProbe(obstacleIndex, approach);
    },
    getFlushTangentPosition(obstacleIndex, approach, beyondPx) {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2eFlushTangentPosition(obstacleIndex, approach, beyondPx);
    },
    resolvePlayerObstacleOverlap() {
      activeDefense(game)?.e2eResolvePlayerObstacleOverlap();
    },
    getDefenseCameraScroll() {
      return (
        activeDefense(game)?.e2eGetDefenseCameraScroll() ?? { x: 0, y: 0 }
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
      return scene.e2eHudLayoutProbe();
    },
    worldPointToDefenseScreen(worldX: number, worldY: number) {
      return (
        activeDefense(game)?.e2eWorldPointToScreen(worldX, worldY) ?? {
          x: 0,
          y: 0,
        }
      );
    },
    async sampleDefenseHudBandPixelsAsync() {
      const scene = activeDefense(game);
      if (!scene) throw new Error("DefenseScene not active");
      return scene.e2eSampleHudBandPixelsAsync();
    },
    setShowEnemyPaths(on: boolean) {
      activeDefense(game)?.e2eSetShowEnemyPaths(on);
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
      return town?.scene.isActive() ? town.e2eTownBuildingDebugRectCount() : 0;
    },
    getTownTouchDebugRectCount(): number {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive() ? town.e2eTownTouchDebugRectCount() : 0;
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
      const town = game.scene.getScene("Town") as TownScene | null;
      town?.e2eOpenEndlessPanel();
    },
    isEndlessPanelOpen() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive() ? town.e2eIsEndlessPanelOpen() : false;
    },
    startEndless(enemyId: string, infiniteHp = false) {
      const town = game.scene.getScene("Town") as TownScene | null;
      town?.e2eStartEndless(enemyId, infiniteHp);
    },
    getEndlessPanelDefaultConcurrent() {
      const store = game.registry.get("dataStore") as DataStore | undefined;
      return store?.player.endlessPanelDefaultConcurrent ?? 1;
    },
    setEndlessInfiniteHp(enabled: boolean) {
      const town = game.scene.getScene("Town") as TownScene | null;
      town?.e2eSetEndlessInfiniteHp(enabled);
    },
    getEndlessInfiniteHp() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive()
        ? town.e2eEndlessInfiniteHpEnabled()
        : false;
    },
    isEndlessInfiniteHp() {
      return activeDefense(game)?.e2eIsEndlessInfiniteHp() ?? false;
    },
    getPlayerHp() {
      const defense = activeDefense(game);
      if (defense) return defense.e2ePlayerHp();
      const town = game.scene.getScene("Town") as TownScene | null;
      if (!town?.scene.isActive()) return 0;
      const save = game.registry.get("save") as { player?: { hp?: number } };
      return Math.floor(save?.player?.hp ?? 0);
    },
    scrollEndlessEnemyList(deltaY: number) {
      const town = game.scene.getScene("Town") as TownScene | null;
      town?.e2eScrollEndlessEnemyList(deltaY);
    },
    getEndlessEnemyListScrollState() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive()
        ? town.e2eEndlessEnemyListScrollState()
        : null;
    },
    getEndlessSelectedEnemyId() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive()
        ? town.e2eEndlessSelectedEnemyId()
        : null;
    },
    getEndlessSelectedEnemyIds() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive() ? town.e2eEndlessSelectedEnemyIds() : [];
    },
    getEndlessRosterEnemyIds() {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive() ? town.e2eEndlessRosterEnemyIds() : [];
    },
    getEndlessEnemyConcurrentCap(enemyId: string) {
      const town = game.scene.getScene("Town") as TownScene | null;
      return town?.scene.isActive()
        ? town.e2eEndlessEnemyConcurrentCap(enemyId)
        : null;
    },
    toggleEndlessEnemy(enemyId: string) {
      const town = game.scene.getScene("Town") as TownScene | null;
      town?.e2eToggleEndlessEnemy(enemyId);
    },
    setEndlessEnemyCap(enemyId: string, cap: number) {
      const town = game.scene.getScene("Town") as TownScene | null;
      town?.e2eSetEndlessEnemyCap(enemyId, cap);
    },
    isEndlessDefense() {
      return activeDefense(game)?.e2eIsEndlessMode() ?? false;
    },
    isWavePlannerDefense() {
      return activeDefense(game)?.isWavePlannerMode() ?? false;
    },
    getLivingEnemyDefIds() {
      return activeDefense(game)?.e2eLivingEnemyDefIds() ?? [];
    },
    getEndlessEnemyId() {
      return activeDefense(game)?.e2eEndlessEnemyId() ?? null;
    },
    getEndlessEnemyIds() {
      return activeDefense(game)?.e2eEndlessEnemyIds() ?? [];
    },
    hasLeaveEndlessButton() {
      return activeDefense(game)?.e2eHasLeaveEndlessButton() ?? false;
    },
    canFocusFirstLivingEnemy() {
      return activeDefense(game)?.e2eCanFocusFirstLivingEnemy() ?? false;
    },
    damageFirstLivingEnemy(amount: number) {
      activeDefense(game)?.e2eDamageFirstLivingEnemy(amount);
    },
    previewHolyFx(kind: "flash" | "channel") {
      activeDefense(game)?.e2ePreviewHolyFx(kind);
    },
    showcaseEnemyMeleeSwipe(defId: string, offX: number) {
      const defense = activeDefense(game);
      if (!defense) return;
      const result = defense.e2eShowcaseEnemyMeleeSwipe(defId, offX);
      publishE2E({
        flags: {
          lastEnemyMeleeFxSide: result.side,
        },
      });
    },
    previewEnemyMeleeFx(enemyDefId: string, offX = 52) {
      const defense = activeDefense(game);
      if (!defense) return;
      const result = defense.e2ePreviewEnemyMeleeFx(enemyDefId, offX);
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
