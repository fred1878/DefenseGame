import { PLAYER_TUNING, SPELL_BAR } from "../config";
import {
  createDefaultAutoCastSpellIds,
  normalizeAutoCastSpellIds,
} from "../content/spellBarAutoCast";
import { createDefaultSpellBarSlots } from "../content/spells";
import {
  SAVE_VERSION,
  type NightResult,
  type SaveGame,
  type SaveSpellBar,
} from "./saveTypes";
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
    },
    spellBar: {
      slots: createDefaultSpellBarSlots(),
      autoCastSpellIds: createDefaultAutoCastSpellIds(),
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

  const autoCastSpellIds = normalizeAutoCastSpellIds(slots, raw);

  return { slots, autoCastSpellIds };
}

const LEGACY_SPELL_ID: Record<string, string> = {
  nova: "fire_nova",
  fireball: "fire_bolt",
};

function remapSpellBarIds(spellBar: SaveSpellBar): SaveSpellBar {
  return {
    ...spellBar,
    slots: spellBar.slots.map((id) => LEGACY_SPELL_ID[id] ?? id),
  };
}

export type LegacySavePlayer = Partial<SaveGame["player"]> & { moveSpeed?: number };

export function mergePlayerWithoutLegacyMoveSpeed(
  base: SaveGame["player"],
  raw?: LegacySavePlayer,
): SaveGame["player"] {
  if (!raw) return { ...base };
  const { moveSpeed: _legacy, ...rest } = raw;
  return { ...base, ...rest };
}

function migrateSave(
  save: SaveGame & {
    spellBar?: SaveGame["spellBar"];
    player?: LegacySavePlayer;
  },
): SaveGame {
  const base = createNewSave();
  const spellBar = remapSpellBarIds(normalizeSpellBar(save.spellBar));
  if (save.spellBar?.slots?.length === 3) {
    spellBar.slots = [
      ...save.spellBar.slots.map((id) => LEGACY_SPELL_ID[id] ?? id),
      ...Array(Math.max(0, SPELL_BAR.slotCount - 3)).fill(""),
    ].slice(0, SPELL_BAR.slotCount);
  }
  return {
    ...base,
    ...save,
    player: mergePlayerWithoutLegacyMoveSpeed(base.player, save.player),
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
      autoCastSpellIds: [...save.spellBar.autoCastSpellIds],
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

/** Persist wall/player HP after endless training without meta rewards. */
export function applyEndlessRunExit(
  save: SaveGame,
  wallHp: number,
  playerHp: number,
): SaveGame {
  const hp = Math.min(save.player.hpMax, Math.max(0, Math.floor(playerHp)));
  return {
    ...save,
    townWallHp: Math.max(0, Math.floor(wallHp)),
    player: { ...save.player, hp: hp > 0 ? hp : save.player.hp },
  };
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
