import type { SaveGame } from "../config";

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
  spawnTestEnemy(x?: number, y?: number): void;
  setGodMode(on: boolean): void;
  damagePlayer(amount: number): void;
  killAllEnemies(): void;
  forceWinNight(): void;
  textureLoaded(key: string): boolean;
  sampleFps(seconds?: number): Promise<number>;
  getAttackPhase(): string;
  getProjectileCount(): number;
  getEnemyCount(): number;
  setManualReturnToTown(on: boolean): void;
  nightEnded(): boolean;
  hasReturnButton(): boolean;
  getUiTapTargets(): Record<string, { x: number; y: number }>;
  isUiButtonPressed(testId: string): boolean;
  syncDomMirrors(): void;
  tapDomMirror(testId: string): void;
  simulateScreenTap(x: number, y: number): void;
  getDefenseWallHp(): number;
  setSpawnPlanComplete(): void;
  e2eBottomChromeTextureKey(): string | null;
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