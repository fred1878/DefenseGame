import type { SaveGame } from "../core/saveTypes";

export type DefenseGameE2EState = {
  ready: boolean;
  scene: string;
  assetsLoaded: boolean;
  player: { x: number; y: number } | null;
  flags: Record<string, boolean | number | string>;
  api: DefenseGameE2EApi | null;
};

export type DefenseGameE2EApi = {
  startNight(): void;
  setStick(dx: number, dy: number, ms?: number): Promise<void>;
  clearStick(): void;
  tapMelee(): void;
  tapRanged(): void;
  castSpell(slot: number): Promise<void>;
  getSave(): SaveGame | null;
  setSave(partial: Partial<SaveGame>): void;
  /** Override live movement tuning via PLAYER_TUNING. */
  setPlayerMoveSpeedWu(moveSpeedWu: number): void;
  spawnTestEnemy(x?: number, y?: number): void;
  setGodMode(on: boolean): void;
  damagePlayer(amount: number): void;
  killAllEnemies(): void;
  forceWinNight(): void;
  textureLoaded(key: string): boolean;
  auditSpellBarTextures(): Array<{
    slot: number;
    spellId: string;
    key: string;
    loaded: boolean;
    width: number;
    height: number;
  }>;
  sampleFps(seconds?: number): Promise<number>;
  getAttackPhase(): string;
  getProjectileCount(): number;
  getEnemyCount(): number;
  setManualReturnToTown(on: boolean): void;
  nightEnded(): boolean;
  hasReturnButton(): boolean;
  returnToTown(): void;
  getUiTapTargets(): Record<string, { x: number; y: number }>;
  getSpellSlotHitRects(): Array<{
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  isUiButtonPressed(testId: string): boolean;
  getAutoAttackEnabled(): boolean;
  syncDomMirrors(): void;
  tapDomMirror(testId: string): void;
  simulateScreenTap(x: number, y: number): void;
  getDefenseWallHp(): number;
  setSpawnPlanComplete(): void;
  e2eBottomChromeTextureKey(): string | null;
  setPlayerPosition(x: number, y: number): void;
  getPlayerPosition(): { x: number; y: number };
  getObstacleBlockerAabb(index: number): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    cx: number;
    cy: number;
    w: number;
    h: number;
  };
  getObstacleArcadeBodyAabb(index: number): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    cx: number;
    cy: number;
    w: number;
    h: number;
  };
  getPlayerBodyRadius(): number;
  getMaxPlayerObstacleOverlapPx(obstacleIndex?: number): number;
  centerDefenseCameraOn(worldX: number, worldY: number): void;
  getObstacleBumpProbe(
    obstacleIndex: number,
    approach: "north" | "south" | "east" | "west",
  ): {
    player: { x: number; y: number };
    surfaceGapPx: number;
    penetrationPx: number;
    edgeErrPx: number;
    pastCenter: boolean;
  };
  getFlushTangentPosition(
    obstacleIndex: number,
    approach: "north" | "south" | "east" | "west",
    beyondPx: number,
  ): { x: number; y: number };
  resolvePlayerObstacleOverlap(): void;
  getDefenseCameraScroll(): { x: number; y: number };
  /** Field half-extents in world px (after Boot applied `defense-maps.json`). */
  getDefenseHalfHeight(): number;
  getDefenseHalfWidth(): number;
  getDefenseHudLayoutProbe(): ReturnType<
    import("../scenes/DefenseScene").DefenseScene["e2eHudLayoutProbe"]
  >;
  worldPointToDefenseScreen(
    worldX: number,
    worldY: number,
  ): { x: number; y: number };
  sampleDefenseHudBandPixelsAsync(): Promise<
    Awaited<
      ReturnType<
        import("../scenes/DefenseScene").DefenseScene["e2eSampleHudBandPixelsAsync"]
      >
    >
  >;
  setShowEnemyPaths(on: boolean): void;
  setShowHitboxes(on: boolean): void;
  setShowTouchInput(on: boolean): void;
  getTownBuildingDebugRectCount(): number;
  getTownTouchDebugRectCount(): number;
  openSpellSortPanel(): void;
  isSpellSortPanelOpen(): boolean;
  getSpellSortSlotHitRects(): Array<{
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  getSpellSortBarSlots(): string[];
  openEndlessPanel(): void;
  isEndlessPanelOpen(): boolean;
  startEndless(enemyId: string, infiniteHp?: boolean): void;
  getEndlessPanelDefaultConcurrent(): number;
  setEndlessInfiniteHp(enabled: boolean): void;
  getEndlessInfiniteHp(): boolean;
  isEndlessInfiniteHp(): boolean;
  getPlayerHp(): number;
  scrollEndlessEnemyList(deltaY: number): void;
  getEndlessEnemyListScrollState(): {
    scrollY: number;
    maxScroll: number;
    listTop: number;
    listViewportH: number;
    contentHeight: number;
    scrollbarVisible: boolean;
    maxVisibleRows: number;
  } | null;
  getEndlessSelectedEnemyId(): string | null;
  getEndlessSelectedEnemyIds(): string[];
  getEndlessRosterEnemyIds(): string[];
  getEndlessEnemyConcurrentCap(enemyId: string): number | null;
  toggleEndlessEnemy(enemyId: string): void;
  setEndlessEnemyCap(enemyId: string, cap: number): void;
  isEndlessDefense(): boolean;
  getEndlessEnemyId(): string | null;
  getEndlessEnemyIds(): string[];
  hasLeaveEndlessButton(): boolean;
  canFocusFirstLivingEnemy(): boolean;
  damageFirstLivingEnemy(amount: number): void;
  previewHolyFx(kind: "flash" | "channel"): void;
};

declare global {
  interface Window {
    __DEFENSEGAME_E2E__?: DefenseGameE2EState;
  }
}

export function defaultE2EState(): DefenseGameE2EState {
  return {
    ready: false,
    scene: "boot",
    assetsLoaded: false,
    player: null,
    flags: {},
    api: null,
  };
}

export function getE2EState(): DefenseGameE2EState {
  if (typeof window === "undefined") {
    return defaultE2EState();
  }
  if (!window.__DEFENSEGAME_E2E__) {
    window.__DEFENSEGAME_E2E__ = defaultE2EState();
  }
  return window.__DEFENSEGAME_E2E__;
}

export function publishE2E(
  patch: Partial<Omit<DefenseGameE2EState, "api">> & {
    api?: Partial<DefenseGameE2EApi> | null;
  },
): void {
  const cur = getE2EState();
  const next: DefenseGameE2EState = {
    ...cur,
    ...patch,
    flags: patch.flags ? { ...cur.flags, ...patch.flags } : cur.flags,
    api: patch.api === undefined
      ? cur.api
      : patch.api === null
        ? null
        : { ...(cur.api ?? ({} as DefenseGameE2EApi)), ...patch.api },
  };
  window.__DEFENSEGAME_E2E__ = next;
}