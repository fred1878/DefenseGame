import {
  PLAYER_TUNING,
  SAVE_VERSION,
  SPELL_BAR,
  createDefaultSpellBarAutoCast,
  createDefaultSpellBarSlots,
  type NightResult,
  type SaveGame,
  type SaveSpellBar,
} from "../config";
import { DEFAULT_ENEMY_BASE } from "./enemyTuning";
import { saveStorageKey } from "../e2e/e2eMode";

function storageKey(): string {
  return saveStorageKey();
}

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
    spellBar: {
      slots: createDefaultSpellBarSlots(),
      autoCast: createDefaultSpellBarAutoCast(),
    },
    flags: [],
  };
}

export function loadSave(): SaveGame {
  if (typeof localStorage === "undefined") {
    return createNewSave();
  }
  try {
    const raw = localStorage.getItem(storageKey());
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

function normalizeSpellBar(raw?: Partial<SaveSpellBar>): SaveSpellBar {
  const base = createNewSave().spellBar;
  const slots = [...(raw?.slots ?? base.slots)];
  while (slots.length < SPELL_BAR.slotCount) slots.push("");
  if (slots.length > SPELL_BAR.slotCount) slots.length = SPELL_BAR.slotCount;

  const autoCast = [...(raw?.autoCast ?? base.autoCast)];
  while (autoCast.length < SPELL_BAR.slotCount) autoCast.push(false);
  if (autoCast.length > SPELL_BAR.slotCount) autoCast.length = SPELL_BAR.slotCount;

  return { slots, autoCast };
}

function migrateSave(save: SaveGame & { spellBar?: SaveGame["spellBar"] }): SaveGame {
  const base = createNewSave();
  const spellBar = normalizeSpellBar(save.spellBar);
  if (save.spellBar?.slots?.length === 3) {
    spellBar.slots = [
      ...save.spellBar.slots,
      ...Array(Math.max(0, SPELL_BAR.slotCount - 3)).fill(""),
    ].slice(0, SPELL_BAR.slotCount);
  }
  return {
    ...base,
    ...save,
    player: { ...base.player, ...save.player },
    buildings: { ...base.buildings, ...save.buildings },
    spellBar,
  };
}

export function persistSave(save: SaveGame): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    storageKey(),
    JSON.stringify({ version: SAVE_VERSION, save }),
  );
}

/** Wipes save and reloads (mobile-friendly substitute for hard refresh). */
export function resetSaveAndReload(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(storageKey());
  }
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("fresh", String(Date.now()));
  window.location.replace(url.toString());
}

/** Ensures save values allow starting a new defense night after a loss (wall or player at 0). */
export function prepareDefenseNight(save: SaveGame): SaveGame {
  const next: SaveGame = {
    ...save,
    player: { ...save.player },
    buildings: { ...save.buildings },
    spellBar: {
      slots: [...save.spellBar.slots],
      autoCast: [...save.spellBar.autoCast],
    },
    flags: [...save.flags],
  };
  if (next.townWallHp <= 0) {
    next.townWallHp = next.townWallHpMax;
  }
  if (next.player.hp <= 0) {
    next.player.hp = next.player.hpMax;
  }
  return next;
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

/** Placeholder tuning hook for tests / content parity with default grunt row. */
export function gruntMaxHp(): number {
  return DEFAULT_ENEMY_BASE.hp;
}