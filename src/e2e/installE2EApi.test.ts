import { playerTuning } from "../config/player";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNewSave } from "../core/save/GameState";
import { SPELL_BAR } from "../config";
import { applyPlayerTuning } from "../config/player";
import { spellIconTextureKey } from "../content/assets";
import { getE2EState } from "./e2eGlobal";
import { buildApi } from "./installE2EApi";

type Fn = ReturnType<typeof vi.fn>;

const E2E_METHODS = [
  "setStick",
  "tapMelee",
  "tapRanged",
  "castSpellSlot",
  "spawnEnemy",
  "playerPosition",
  "damagePlayer",
  "killAllEnemies",
  "forceWinNight",
  "attackPhase",
  "projectileCount",
  "attackMode",
  "livingEnemyHps",
  "livingEnemyPositions",
  "setAttackMode",
  "enemyCount",
  "setManualReturn",
  "nightEnded",
  "hasReturnButton",
  "getUiTapTargets",
  "getSpellSlotHitRects",
  "isTouchButtonPressed",
  "autoAttackEnabled",
  "simulateScreenTap",
  "wallHp",
  "bottomChromeTextureKey",
  "setSpawnPlanComplete",
  "setPlayerPosition",
  "obstacleBlockerAabb",
  "obstacleArcadeBodyAabb",
  "playerBodyRadius",
  "maxPlayerObstacleOverlapPx",
  "centerCameraOn",
  "obstacleBumpProbe",
  "flushTangentPosition",
  "resolvePlayerObstacleOverlap",
  "getDefenseCameraScroll",
  "hudLayoutProbe",
  "worldPointToScreen",
  "sampleHudBandPixelsAsync",
  "setShowEnemyPaths",
  "playerHp",
  "isEndlessInfiniteHp",
  "isEndlessMode",
  "livingEnemyDefIds",
  "endlessEnemyId",
  "endlessEnemyIds",
  "hasLeaveEndlessButton",
  "canFocusFirstLivingEnemy",
  "damageFirstLivingEnemy",
  "previewHolyFx",
  "showcaseEnemyMeleeSwipe",
  "previewEnemyMeleeFx",
] as const;

function defenseFns(): Record<(typeof E2E_METHODS)[number], Fn> {
  const fns = {} as Record<(typeof E2E_METHODS)[number], Fn>;
  for (const name of E2E_METHODS) {
    fns[name] = vi.fn();
  }
  fns.playerPosition.mockReturnValue({ x: 10, y: 20 });
  fns.attackPhase.mockReturnValue("idle");
  fns.projectileCount.mockReturnValue(2);
  fns.attackMode.mockReturnValue("melee");
  fns.livingEnemyHps.mockReturnValue([8, 3]);
  fns.livingEnemyPositions.mockReturnValue([{ x: 1, y: 2, hp: 8 }]);
  fns.enemyCount.mockReturnValue(2);
  fns.nightEnded.mockReturnValue(false);
  fns.hasReturnButton.mockReturnValue(false);
  fns.getUiTapTargets.mockReturnValue({ "combat-atk": { x: 100, y: 200 } });
  fns.getSpellSlotHitRects.mockReturnValue([]);
  fns.isTouchButtonPressed.mockReturnValue(false);
  fns.autoAttackEnabled.mockReturnValue(true);
  fns.wallHp.mockReturnValue(80);
  fns.bottomChromeTextureKey.mockReturnValue("chrome");
  fns.playerBodyRadius.mockReturnValue(14);
  fns.maxPlayerObstacleOverlapPx.mockReturnValue(0);
  fns.obstacleBlockerAabb.mockReturnValue({
    left: 0,
    top: 0,
    right: 10,
    bottom: 10,
    cx: 5,
    cy: 5,
    w: 10,
    h: 10,
  });
  fns.obstacleArcadeBodyAabb.mockReturnValue({
    left: 1,
    top: 1,
    right: 9,
    bottom: 9,
    cx: 5,
    cy: 5,
    w: 8,
    h: 8,
  });
  fns.obstacleBumpProbe.mockReturnValue({
    player: { x: 0, y: 0 },
    surfaceGapPx: 1,
    penetrationPx: 0,
    edgeErrPx: 0,
    pastCenter: false,
  });
  fns.flushTangentPosition.mockReturnValue({ x: 4, y: 5 });
  fns.getDefenseCameraScroll.mockReturnValue({ x: 1, y: 2 });
  fns.hudLayoutProbe.mockReturnValue({ ok: true });
  fns.worldPointToScreen.mockReturnValue({ x: 30, y: 40 });
  fns.sampleHudBandPixelsAsync.mockResolvedValue({ samples: 1 });
  fns.playerHp.mockReturnValue(42);
  fns.isEndlessInfiniteHp.mockReturnValue(false);
  fns.isEndlessMode.mockReturnValue(false);
  fns.livingEnemyDefIds.mockReturnValue(["grunt"]);
  fns.endlessEnemyId.mockReturnValue(null);
  fns.endlessEnemyIds.mockReturnValue([]);
  fns.hasLeaveEndlessButton.mockReturnValue(false);
  fns.canFocusFirstLivingEnemy.mockReturnValue(true);
  fns.showcaseEnemyMeleeSwipe.mockReturnValue({ side: "right" });
  fns.previewEnemyMeleeFx.mockReturnValue({ side: "left" });
  fns.castSpellSlot.mockResolvedValue(undefined);
  return fns;
}

type TownFns = {
  e2eStartNight: Fn;
  e2eGetUiTapTargets: Fn;
  e2eIsTouchButtonPressed: Fn;
  e2eTownBuildingDebugRectCount: Fn;
  e2eTownTouchDebugRectCount: Fn;
  e2eOpenSpellSortPanel: Fn;
  e2eIsSpellSortPanelOpen: Fn;
  e2eGetSpellSortSlotHitRects: Fn;
  e2eGetSpellSortBarSlots: Fn;
  e2eOpenEndlessPanel: Fn;
  e2eStartEndless: Fn;
};

function townFns(): TownFns {
  return {
    e2eStartNight: vi.fn(),
    e2eGetUiTapTargets: vi.fn(() => ({ "start-night": { x: 20, y: 30 } })),
    e2eIsTouchButtonPressed: vi.fn(() => true),
    e2eTownBuildingDebugRectCount: vi.fn(() => 3),
    e2eTownTouchDebugRectCount: vi.fn(() => 4),
    e2eOpenSpellSortPanel: vi.fn(),
    e2eIsSpellSortPanelOpen: vi.fn(() => true),
    e2eGetSpellSortSlotHitRects: vi.fn(() => [
      { index: 0, x: 1, y: 2, width: 3, height: 4 },
    ]),
    e2eGetSpellSortBarSlots: vi.fn(() => ["fire_bolt"]),
    e2eOpenEndlessPanel: vi.fn(),
    e2eStartEndless: vi.fn(),
  };
}

/** Roster hooks on the Endless setup scene (reached when it is the active Town UI host). */
function endlessSetupFns() {
  return {
    e2eIsOpen: vi.fn(() => true),
    e2eStartEndless: vi.fn(),
    e2eSetEndlessInfiniteHp: vi.fn(),
    e2eEndlessInfiniteHpEnabled: vi.fn(() => true),
    e2eScrollEndlessEnemyList: vi.fn(),
    e2eEndlessEnemyListScrollState: vi.fn(() => ({
      scrollY: 10,
      maxScroll: 40,
      listTop: 0,
      listViewportH: 100,
      contentHeight: 140,
      scrollbarVisible: true,
      maxVisibleRows: 5,
    })),
    e2eEndlessSelectedEnemyId: vi.fn(() => "grunt"),
    e2eEndlessSelectedEnemyIds: vi.fn(() => ["grunt"]),
    e2eEndlessRosterEnemyIds: vi.fn(() => ["grunt", "lobber"]),
    e2eEndlessEnemyConcurrentCap: vi.fn(() => 2),
    e2eToggleEndlessEnemy: vi.fn(),
    e2eSetEndlessEnemyCap: vi.fn(),
  };
}

function withEndlessSetup(game: ReturnType<typeof makeGame>) {
  const fns = endlessSetupFns();
  const setup = {
    scene: {
      key: "TownEndlessSetup",
      isActive: () => true,
      isPaused: () => false,
    },
    ...fns,
  };
  const inner = game.scene.getScene.bind(game.scene);
  (game.scene as { getScene: (key: string) => unknown }).getScene = (
    key: string,
  ) => {
    if (key === "TownEndlessSetup") return setup;
    return inner(key);
  };
  return fns;
}

function makeGame(opts: {
  defenseActive?: boolean;
  townActive?: boolean;
  save?: ReturnType<typeof createNewSave> | undefined;
  textures?: Record<string, { width: number; height: number }>;
  dataStore?: { player: { endlessPanelDefaultConcurrent: number } };
}) {
  const defenseMethods = defenseFns();
  const townMethods = townFns();
  const registry = new Map<string, unknown>();
  if (opts.save) registry.set("save", opts.save);
  if (opts.dataStore) registry.set("dataStore", opts.dataStore);
  const defense = {
    scene: { isActive: () => !!opts.defenseActive },
    e2e: defenseMethods,
    e2eReturnToTown: vi.fn(),
    spawnEnemyAt: vi.fn(),
    isWavePlannerMode: vi.fn(() => true),
    registry: {
      get: (key: string) => registry.get(key),
      set: (key: string, value: unknown) => {
        registry.set(key, value);
      },
    },
  };
  const town = {
    scene: { isActive: () => !!opts.townActive },
    ...townMethods,
  };
  const textures = opts.textures ?? {};
  const stepListeners: Array<() => void> = [];
  const game = {
    scene: {
      getScene: (key: string) => {
        if (key === "Defense") return defense;
        if (key === "Town") return town;
        return null;
      },
      start: vi.fn(),
    },
    registry: {
      get: (key: string) => registry.get(key),
      set: (key: string, value: unknown) => {
        registry.set(key, value);
      },
    },
    textures: {
      exists: (key: string) => key in textures,
      get: (key: string) => ({
        get: () => textures[key] ?? { width: 0, height: 0 },
      }),
    },
    loop: { actualFps: 60, time: 0 },
    events: {
      on: vi.fn((event: string, fn: () => void) => {
        if (event === "step") stepListeners.push(fn);
      }),
      off: vi.fn((_event: string, fn: () => void) => {
        const i = stepListeners.indexOf(fn);
        if (i >= 0) stepListeners.splice(i, 1);
      }),
    },
    emitStep() {
      for (const fn of [...stepListeners]) fn();
    },
    registryMap: registry,
    defense,
    town,
    defenseMethods,
    townMethods,
  };
  return game;
}

describe("buildApi", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { href: "http://localhost/" },
      __DEFENSEGAME_E2E__: undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses idle / empty fallbacks when Defense is inactive", async () => {
    const game = makeGame({ defenseActive: false, townActive: false });
    const api = buildApi(game as never);
    await api.setStick(1, 0, 10);
    api.clearStick();
    api.tapMelee();
    api.tapRanged();
    await api.castSpell(0);
    api.spawnTestEnemy();
    api.spawnTestEnemyByDef("grunt");
    api.damagePlayer(5);
    api.killAllEnemies();
    api.forceWinNight();
    api.setManualReturnToTown(true);
    api.returnToTown();
    api.tapDomMirror("combat-atk");
    api.simulateScreenTap(1, 2);
    api.setSpawnPlanComplete();
    api.setPlayerPosition(3, 4);
    api.centerDefenseCameraOn(5, 6);
    api.resolvePlayerObstacleOverlap();
    api.setShowEnemyPaths(true);
    api.setShowHitboxes(true);
    api.syncDomMirrors();
    api.damageFirstLivingEnemy(2);
    api.previewHolyFx("flash");
    api.showcaseEnemyMeleeSwipe("grunt", 10);
    api.previewEnemyMeleeFx("grunt");
    expect(api.getAttackPhase()).toBe("idle");
    expect(api.getProjectileCount()).toBe(0);
    expect(api.getAttackMode()).toBeNull();
    expect(api.getLivingEnemyHps()).toEqual([]);
    expect(api.getLivingEnemyPositions()).toEqual([]);
    api.resetCombatTally();
    expect(api.getCombatTally()).toEqual({});
    expect(api.getSpellCastState()).toEqual({
      activeSpellId: null,
      phase: null,
      readyWindupSpellIds: [],
    });
    api.setAttackMode("ranged");
    expect(api.getEnemyCount()).toBe(0);
    expect(api.nightEnded()).toBe(false);
    expect(api.hasReturnButton()).toBe(false);
    expect(api.getUiTapTargets()).toEqual({});
    expect(api.getSpellSlotHitRects()).toEqual([]);
    expect(api.isUiButtonPressed("combat-atk")).toBe(false);
    expect(api.getAutoAttackEnabled()).toBe(false);
    expect(api.getDefenseWallHp()).toBe(0);
    expect(api.e2eBottomChromeTextureKey()).toBeNull();
    expect(api.getPlayerPosition()).toEqual({ x: 0, y: 0 });
    expect(api.getPlayerBodyRadius()).toBe(0);
    expect(api.getMaxPlayerObstacleOverlapPx()).toBe(0);
    expect(api.getDefenseCameraScroll()).toEqual({ x: 0, y: 0 });
    expect(api.worldPointToDefenseScreen(1, 2)).toEqual({ x: 0, y: 0 });
    expect(api.getPlayerHp()).toBe(0);
    expect(api.isEndlessInfiniteHp()).toBe(false);
    expect(api.isEndlessDefense()).toBe(false);
    expect(api.isWavePlannerDefense()).toBe(false);
    expect(api.getLivingEnemyDefIds()).toEqual([]);
    expect(api.getEndlessEnemyId()).toBeNull();
    expect(api.getEndlessEnemyIds()).toEqual([]);
    expect(api.hasLeaveEndlessButton()).toBe(false);
    expect(api.canFocusFirstLivingEnemy()).toBe(false);
    expect(api.getSave()).toBeNull();
    api.setSave({ gold: 10 });
    expect(() => api.getObstacleBlockerAabb(0)).toThrow(
      /DefenseScene not active/,
    );
    expect(() => api.getObstacleArcadeBodyAabb(0)).toThrow(
      /DefenseScene not active/,
    );
    expect(() => api.getObstacleBumpProbe(0, "north")).toThrow(
      /DefenseScene not active/,
    );
    expect(() => api.getFlushTangentPosition(0, "east", 4)).toThrow(
      /DefenseScene not active/,
    );
    expect(() => api.getDefenseHudLayoutProbe()).toThrow(
      /DefenseScene not active/,
    );
    await expect(api.sampleDefenseHudBandPixelsAsync()).rejects.toThrow(
      /DefenseScene not active/,
    );
    api.startNight();
    expect(game.scene.start).toHaveBeenCalledWith("Defense");
  });

  it("starts the night from an active Town scene", () => {
    const game = makeGame({ townActive: true });
    const api = buildApi(game as never);
    api.startNight();
    expect(game.town.e2eStartNight).toHaveBeenCalledOnce();
    expect(game.scene.start).not.toHaveBeenCalled();
  });

  it("holds the stick for a duration then recenters it", async () => {
    const game = makeGame({ defenseActive: true });
    const api = buildApi(game as never);
    const pending = api.setStick(1, 0, 40);
    // time has not advanced yet
    expect(game.defenseMethods.setStick).toHaveBeenCalledWith(1, 0);
    game.loop.time = 40;
    game.emitStep();
    await pending;
    expect(game.defenseMethods.setStick).toHaveBeenLastCalledWith(0, 0);
    expect(game.events.off).toHaveBeenCalled();
  });

  it("forwards Defense combat and query hooks", async () => {
    const save = createNewSave();
    save.player.hp = 17;
    const game = makeGame({ defenseActive: true, save });
    const api = buildApi(game as never);
    api.clearStick();
    api.tapMelee();
    api.tapRanged();
    await api.castSpell(2);
    api.spawnTestEnemy(3, 4);
    api.spawnTestEnemyByDef("lobber", 8, 2);
    api.damagePlayer(3);
    api.killAllEnemies();
    api.forceWinNight();
    api.setManualReturnToTown(true);
    api.returnToTown();
    api.syncDomMirrors();
    api.tapDomMirror("combat-atk");
    api.tapDomMirror("missing");
    api.simulateScreenTap(9, 8);
    api.setSpawnPlanComplete();
    api.setPlayerPosition(11, 12);
    api.centerDefenseCameraOn(13, 14);
    api.resolvePlayerObstacleOverlap();
    api.setShowEnemyPaths(true);
    api.setShowHitboxes(true);
    api.setShowTouchInput(true);
    api.damageFirstLivingEnemy(7);
    api.previewHolyFx("channel");
    api.showcaseEnemyMeleeSwipe("grunt", 12);
    expect(getE2EState().flags.lastEnemyMeleeFxSide).toBe("right");
    api.previewEnemyMeleeFx("charger", 9);
    expect(getE2EState().flags.lastEnemyMeleeFxSide).toBe("left");
    api.clearEnemyMeleeFxFlag();

    expect(game.defenseMethods.setStick).toHaveBeenCalledWith(0, 0);
    expect(game.defenseMethods.tapMelee).toHaveBeenCalledOnce();
    expect(game.defenseMethods.tapRanged).toHaveBeenCalledOnce();
    expect(game.defenseMethods.castSpellSlot).toHaveBeenCalledWith(2);
    expect(game.defenseMethods.spawnEnemy).toHaveBeenCalledWith(3, 4);
    expect(game.defense.spawnEnemyAt).toHaveBeenCalledWith(
      18,
      22,
      undefined,
      "lobber",
      999,
    );
    expect(api.getAttackPhase()).toBe("idle");
    expect(api.getProjectileCount()).toBe(2);
    expect(api.getAttackMode()).toBe("melee");
    expect(api.getLivingEnemyHps()).toEqual([8, 3]);
    expect(api.getLivingEnemyPositions()).toEqual([{ x: 1, y: 2, hp: 8 }]);
    api.setAttackMode("ranged");
    expect(game.defenseMethods.setAttackMode).toHaveBeenCalledWith("ranged");
    expect(api.getEnemyCount()).toBe(2);
    expect(api.nightEnded()).toBe(false);
    expect(api.hasReturnButton()).toBe(false);
    expect(api.getUiTapTargets()).toEqual({ "combat-atk": { x: 100, y: 200 } });
    expect(api.isUiButtonPressed("combat-atk")).toBe(false);
    expect(api.getAutoAttackEnabled()).toBe(true);
    expect(api.getDefenseWallHp()).toBe(80);
    expect(api.e2eBottomChromeTextureKey()).toBe("chrome");
    expect(api.getPlayerPosition()).toEqual({ x: 10, y: 20 });
    expect(api.getPlayerBodyRadius()).toBe(14);
    expect(api.getMaxPlayerObstacleOverlapPx(1)).toBe(0);
    expect(api.getObstacleBlockerAabb(0).w).toBe(10);
    expect(api.getObstacleArcadeBodyAabb(0).w).toBe(8);
    expect(api.getObstacleBumpProbe(0, "west").surfaceGapPx).toBe(1);
    expect(api.getFlushTangentPosition(0, "south", 3)).toEqual({ x: 4, y: 5 });
    expect(api.getDefenseCameraScroll()).toEqual({ x: 1, y: 2 });
    expect(api.getDefenseHudLayoutProbe()).toEqual({ ok: true });
    expect(api.worldPointToDefenseScreen(1, 2)).toEqual({ x: 30, y: 40 });
    await expect(api.sampleDefenseHudBandPixelsAsync()).resolves.toEqual({
      samples: 1,
    });
    expect(api.getPlayerHp()).toBe(42);
    expect(api.isEndlessDefense()).toBe(false);
    expect(api.isWavePlannerDefense()).toBe(true);
    expect(api.getDefenseHalfWidth()).toBeGreaterThan(0);
    expect(api.getDefenseHalfHeight()).toBeGreaterThan(0);
    expect(game.registryMap.get("e2eManualReturn")).toBe(true);
    expect(game.registryMap.get("e2eGodMode")).toBeUndefined();
    api.setGodMode(true);
    expect(game.registryMap.get("e2eGodMode")).toBe(true);
    expect(getE2EState().flags.godMode).toBe(true);
    expect(getE2EState().flags.lastEnemyMeleeFxSide).toBe("");
    expect(getE2EState().flags.enemyMeleeFxSpawned).toBe(0);
  });

  it("clones and merges save data, ignoring a missing base save", () => {
    const save = createNewSave();
    save.gold = 5;
    save.player.hp = 10;
    const game = makeGame({ save });
    const api = buildApi(game as never);
    const copy = api.getSave();
    expect(copy).toEqual(save);
    expect(copy).not.toBe(save);
    api.setSave({
      gold: 99,
      player: { hp: 7, moveSpeed: 999 } as never,
      buildings: { wall: 2 },
      flags: ["x"],
      spellBar: { slots: ["heal"], autoCastSpellIds: [] },
    });
    const next = game.registryMap.get("save") as ReturnType<
      typeof createNewSave
    >;
    expect(next.gold).toBe(99);
    expect(next.player.hp).toBe(7);
    expect(next.buildings.wall).toBe(2);
    expect(next.flags).toEqual(["x"]);
    expect(next.spellBar.slots).toEqual(["heal"]);
    expect((next.player as { moveSpeed?: number }).moveSpeed).toBeUndefined();
  });

  it("overrides live movement speed and reports texture / fps state", async () => {
    const game = makeGame({});
    const api = buildApi(game as never);
    const previousSpeed = playerTuning().moveSpeedWu;
    api.setPlayerMoveSpeedWu(123);
    expect(playerTuning().moveSpeedWu).toBe(123);
    applyPlayerTuning({ ...playerTuning(), moveSpeedWu: previousSpeed });
    expect(api.textureLoaded("missing")).toBe(false);
    expect(await api.sampleFps(0)).toBe(60);

    vi.useFakeTimers();
    game.loop.actualFps = 50;
    const fpsP = api.sampleFps(0.2);
    await vi.advanceTimersByTimeAsync(250);
    expect(await fpsP).toBe(50);
  });

  it("audits spell bar textures for empty, missing, and loaded slots", () => {
    const save = createNewSave();
    save.spellBar.slots = Array.from({ length: SPELL_BAR.slotCount }, () => "");
    save.spellBar.slots[0] = "fire_bolt";
    save.spellBar.slots[1] = "heal";
    const fireKey = spellIconTextureKey("fire_bolt");
    const game = makeGame({
      save,
      textures: { [fireKey]: { width: 32, height: 32 } },
    });
    const api = buildApi(game as never);
    const audit = api.auditSpellBarTextures();
    expect(audit).toHaveLength(SPELL_BAR.slotCount);
    expect(audit[0]).toMatchObject({
      slot: 0,
      spellId: "fire_bolt",
      key: fireKey,
      loaded: true,
      width: 32,
      height: 32,
    });
    expect(audit[1]).toMatchObject({
      slot: 1,
      spellId: "heal",
      loaded: false,
      width: 0,
      height: 0,
    });
    expect(audit[2]).toMatchObject({
      slot: 2,
      spellId: "",
      key: "",
      loaded: false,
    });
  });

  it("routes town panel hooks when Town is active", () => {
    const game = makeGame({
      townActive: true,
      save: (() => {
        const s = createNewSave();
        s.player.hp = 33;
        return s;
      })(),
      dataStore: { player: { endlessPanelDefaultConcurrent: 4 } },
    });
    const api = buildApi(game as never);
    expect(api.getUiTapTargets()).toEqual({ "start-night": { x: 20, y: 30 } });
    expect(api.isUiButtonPressed("start-night")).toBe(true);
    api.syncDomMirrors();
    expect(api.getTownBuildingDebugRectCount()).toBe(3);
    expect(api.getTownTouchDebugRectCount()).toBe(4);
    api.openSpellSortPanel();
    expect(api.isSpellSortPanelOpen()).toBe(true);
    expect(api.getSpellSortSlotHitRects()).toHaveLength(1);
    expect(api.getSpellSortBarSlots()).toEqual(["fire_bolt"]);
    api.openEndlessPanel();
    expect(game.townMethods.e2eOpenEndlessPanel).toHaveBeenCalled();
    expect(api.isEndlessPanelOpen()).toBe(false);
    api.startEndless("lobber", true);
    expect(game.townMethods.e2eStartEndless).toHaveBeenCalledWith(
      "lobber",
      true,
    );
    expect(api.getEndlessPanelDefaultConcurrent()).toBe(4);
    expect(api.getPlayerHp()).toBe(33);
  });

  it("routes endless roster hooks to the active Endless setup scene", () => {
    const game = makeGame({ townActive: true });
    const setup = withEndlessSetup(game);
    const api = buildApi(game as never);
    expect(api.isEndlessPanelOpen()).toBe(true);
    api.startEndless("lobber", true);
    expect(setup.e2eStartEndless).toHaveBeenCalledWith("lobber", true);
    expect(game.townMethods.e2eStartEndless).not.toHaveBeenCalled();
    api.setEndlessInfiniteHp(true);
    expect(setup.e2eSetEndlessInfiniteHp).toHaveBeenCalledWith(true);
    expect(api.getEndlessInfiniteHp()).toBe(true);
    api.scrollEndlessEnemyList(12);
    expect(setup.e2eScrollEndlessEnemyList).toHaveBeenCalledWith(12);
    expect(api.getEndlessEnemyListScrollState()?.scrollY).toBe(10);
    expect(api.getEndlessSelectedEnemyId()).toBe("grunt");
    expect(api.getEndlessSelectedEnemyIds()).toEqual(["grunt"]);
    expect(api.getEndlessRosterEnemyIds()).toEqual(["grunt", "lobber"]);
    expect(api.getEndlessEnemyConcurrentCap("grunt")).toBe(2);
    api.toggleEndlessEnemy("lobber");
    expect(setup.e2eToggleEndlessEnemy).toHaveBeenCalledWith("lobber");
    api.setEndlessEnemyCap("lobber", 3);
    expect(setup.e2eSetEndlessEnemyCap).toHaveBeenCalledWith("lobber", 3);
  });

  it("returns town-hook fallbacks when Town is inactive", () => {
    const game = makeGame({ townActive: false });
    const api = buildApi(game as never);
    expect(api.getTownBuildingDebugRectCount()).toBe(0);
    expect(api.getTownTouchDebugRectCount()).toBe(0);
    expect(api.isSpellSortPanelOpen()).toBe(false);
    expect(api.getSpellSortSlotHitRects()).toEqual([]);
    expect(api.getSpellSortBarSlots()).toEqual([]);
    expect(api.isEndlessPanelOpen()).toBe(false);
    expect(api.getEndlessPanelDefaultConcurrent()).toBe(1);
    expect(api.getEndlessInfiniteHp()).toBe(false);
    expect(api.getEndlessEnemyListScrollState()).toBeNull();
    expect(api.getEndlessSelectedEnemyId()).toBeNull();
    expect(api.getEndlessSelectedEnemyIds()).toEqual([]);
    expect(api.getEndlessRosterEnemyIds()).toEqual([]);
    expect(api.getEndlessEnemyConcurrentCap("grunt")).toBeNull();
    api.openSpellSortPanel();
    api.openEndlessPanel();
    api.startEndless("grunt");
    api.setEndlessInfiniteHp(false);
    api.scrollEndlessEnemyList(1);
    api.toggleEndlessEnemy("grunt");
    api.setEndlessEnemyCap("grunt", 1);
    expect(game.townMethods.e2eOpenSpellSortPanel).toHaveBeenCalled();
  });

  it("covers setStick, save, and hp fallbacks", async () => {
    const game = makeGame({ defenseActive: true, save: createNewSave() });
    const api = buildApi(game as never);
    await api.setStick(1, 0, 0);
    expect(game.defenseMethods.setStick).toHaveBeenCalledWith(1, 0);
    expect(game.defenseMethods.setStick).toHaveBeenCalledTimes(1);

    api.setSave({ gold: 12 });
    const merged = game.registryMap.get("save") as ReturnType<
      typeof createNewSave
    >;
    expect(merged.gold).toBe(12);
    expect(merged.spellBar.slots.length).toBeGreaterThan(0);

    const noSave = makeGame({ townActive: true });
    const townApi = buildApi(noSave as never);
    expect(townApi.getPlayerHp()).toBe(0);
    expect(
      townApi.auditSpellBarTextures().every((row) => row.spellId === ""),
    ).toBe(true);

    const late = makeGame({ defenseActive: true });
    const lateApi = buildApi(late as never);
    const pending = lateApi.setStick(0, 1, 40);
    late.emitStep();
    late.loop.time = 40;
    late.emitStep();
    await pending;
    expect(late.defenseMethods.setStick).toHaveBeenLastCalledWith(0, 0);
  });
});

describe("buildApi setup-scene leftover branches", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { href: "http://localhost/" },
      __DEFENSEGAME_E2E__: undefined,
    });
  });

  it("hides town building debug rects while a setup scene is active", () => {
    const game = makeGame({ townActive: true });
    const setup = {
      scene: {
        key: "TownEndlessSetup",
        isActive: () => true,
        isPaused: () => false,
      },
      e2eTouchDebugRectCount: () => 11,
    };
    const inner = game.scene.getScene.bind(game.scene);
    (game.scene as { getScene: (key: string) => unknown }).getScene = (
      key: string,
    ) => {
      if (key === "TownEndlessSetup") return setup;
      return inner(key);
    };
    const api = buildApi(game as never);
    expect(api.getTownBuildingDebugRectCount()).toBe(0);
    expect(api.getTownTouchDebugRectCount()).toBe(11);
  });

  it("routes wave-planner setup touch debug rects", () => {
    const game = makeGame({ townActive: true });
    const setup = {
      scene: {
        key: "TownWavePlannerSetup",
        isActive: () => true,
        isPaused: () => false,
      },
      e2eTouchDebugRectCount: () => 7,
    };
    const inner = game.scene.getScene.bind(game.scene);
    (game.scene as { getScene: (key: string) => unknown }).getScene = (
      key: string,
    ) => {
      if (key === "TownWavePlannerSetup") return setup;
      return inner(key);
    };
    const api = buildApi(game as never);
    expect(api.getTownTouchDebugRectCount()).toBe(7);
  });
});
