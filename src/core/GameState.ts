import { SPELL_BAR } from "../config";
import { basePlayerTuning } from "../config/player";
import { getGearCatalog } from "../gear/gearCatalog";
import { gearStatsFor } from "../gear/itemStats";
import { addLootToSave } from "../gear/loot";
import { normalizeSaveShops } from "../gear/shops";
import { createEmptyGear, normalizeSaveGear } from "../gear/saveGear";
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
    buildings: { wall: 0 },
    townWallHp: wallMax,
    townWallHpMax: wallMax,
    player: {
      hp: basePlayerTuning().maxHp,
      hpMax: basePlayerTuning().maxHp,
    },
    gear: createEmptyGear(),
    consumables: {},
    shops: { trader: null },
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

export type LegacySavePlayer = Partial<SaveGame["player"]> & {
  moveSpeed?: number;
  weaponId?: string;
};

export function mergePlayerWithoutLegacyMoveSpeed(
  base: SaveGame["player"],
  raw?: LegacySavePlayer,
): SaveGame["player"] {
  if (!raw) return { ...base };
  const { moveSpeed: _legacy, weaponId: _weapon, ...rest } = raw;
  return { ...base, ...rest };
}

/**
 * Same-version compatibility fixes (legacy spell ids, missing fields).
 * Not a schema bump — callers still reject `version !== SAVE_VERSION`.
 */
export function normalizeSave(
  save: SaveGame & {
    spellBar?: SaveGame["spellBar"];
    player?: LegacySavePlayer;
  },
): SaveGame {
  return migrateSave(save);
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
  return syncPlayerHpMax({
    ...base,
    ...save,
    player: mergePlayerWithoutLegacyMoveSpeed(base.player, save.player),
    gear: normalizeSaveGear(save.gear, getGearCatalog()),
    consumables: normalizeSaveConsumables(save.consumables),
    shops: normalizeSaveShops(save.shops),
    buildings: { ...base.buildings, ...save.buildings },
    spellBar,
  });
}

function normalizeSaveConsumables(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(raw)) {
    if (typeof n === "number" && Number.isFinite(n) && n >= 1) {
      out[id] = Math.floor(n);
    }
  }
  return out;
}

/**
 * Max HP = `player.json` maxHp + equipped gear. A higher cap adds the gain to
 * current HP (like the wall upgrade); a lower cap clamps it.
 */
export function syncPlayerHpMax(save: SaveGame): SaveGame {
  const hpMax = Math.max(
    1,
    basePlayerTuning().maxHp +
      gearStatsFor(getGearCatalog(), save.gear).flat.maxHp,
  );
  const prevMax = save.player.hpMax;
  if (hpMax === prevMax) return save;
  const gained = Math.max(0, hpMax - prevMax);
  const hp = Math.max(1, Math.min(hpMax, save.player.hp + gained));
  return { ...save, player: { ...save.player, hp, hpMax } };
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

/** Share of a night's `rewardGold` paid when the night is lost. */
const LOST_NIGHT_GOLD_PCT = 25;

/** Gold paid at campaign night end: full reward on a win, a quarter on a loss. */
export function nightGoldEarned(won: boolean, rewardGold: number): number {
  return won
    ? rewardGold
    : Math.floor((rewardGold * LOST_NIGHT_GOLD_PCT) / 100);
}

export function applyNightResult(
  save: SaveGame,
  result: NightResult,
): SaveGame {
  // New day in town: the trader restocks on the next visit.
  const next = {
    ...save,
    night: save.night + (result.won ? 1 : 0),
    shops: { ...save.shops, trader: null },
  };
  next.gold = save.gold + result.goldEarned;
  next.townWallHp = Math.max(0, save.townWallHp - result.wallDamage);
  if (result.won) {
    next.player = {
      ...next.player,
      hp: Math.min(next.player.hpMax, next.player.hp + 10),
    };
  }
  if (result.drops?.length) {
    return addLootToSave(next, result.drops, getGearCatalog()).save;
  }
  return next;
}

export function wallHpBonusFromBuildings(
  buildings: Record<string, number>,
): number {
  const wallLevel = buildings.wall ?? 0;
  return wallLevel * 50;
}
