import {
  ENEMY_TUNING,
  PLAYER_TUNING,
  SAVE_VERSION,
  type NightResult,
  type SaveGame,
} from "../config";

const STORAGE_KEY = "defensegame_save_v1";

export function createNewSave(): SaveGame {
  const wallMax = 100;
  return {
    night: 1,
    gold: 0,
    buildings: { wall: 0, blacksmith: 0 },
    townWallHp: wallMax,
    townWallHpMax: wallMax,
    player: {
      hp: PLAYER_TUNING.maxHp,
      hpMax: PLAYER_TUNING.maxHp,
      weaponId: "sword",
      moveSpeed: PLAYER_TUNING.moveSpeed,
    },
    flags: [],
  };
}

export function loadSave(): SaveGame {
  if (typeof localStorage === "undefined") {
    return createNewSave();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createNewSave();
    const parsed = JSON.parse(raw) as { version?: number; save?: SaveGame };
    if (parsed.version !== SAVE_VERSION || !parsed.save) {
      return createNewSave();
    }
    return migrateSave(parsed.save);
  } catch {
    return createNewSave();
  }
}

function migrateSave(save: SaveGame): SaveGame {
  return {
    ...createNewSave(),
    ...save,
    player: { ...createNewSave().player, ...save.player },
    buildings: { ...createNewSave().buildings, ...save.buildings },
  };
}

export function persistSave(save: SaveGame): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: SAVE_VERSION, save }),
  );
}

export function applyNightResult(save: SaveGame, result: NightResult): SaveGame {
  const next = { ...save, night: save.night + (result.won ? 1 : 0) };
  next.gold = save.gold + result.goldEarned;
  next.townWallHp = Math.max(0, save.townWallHp - result.wallDamage);
  if (result.won) {
    next.player = {
      ...next.player,
      hp: Math.min(next.player.hpMax, next.player.hp + 10),
    };
  }
  return next;
}

export function wallHpBonusFromBuildings(buildings: Record<string, number>): number {
  const wallLevel = buildings.wall ?? 0;
  return wallLevel * 50;
}

export function playerDamageMult(buildings: Record<string, number>): number {
  const smith = buildings.blacksmith ?? 0;
  return 1 + smith * 0.1;
}

/** Placeholder tuning hook for tests / future JSON. */
export function gruntMaxHp(): number {
  return ENEMY_TUNING.gruntHp;
}