import type { NightResult, SaveGame } from "../core/saveTypes";
import { applyNightResultDetailed } from "../core/GameState";
import { bagItems } from "./inventory";
import type { ItemDraft } from "./itemGen";
import { resolveItem } from "./itemStats";
import type { GearCatalog } from "./gearTypes";
import { getLootConfig, type LootConfig } from "./loot";

/** Campaign nights shave 2 wall HP on a win (existing end-of-night wear). */
export const CAMPAIGN_WIN_WALL_PENALTY = 2;

export type NightLootSummaryItem = {
  name: string;
  rarityLabel: string;
  color: string;
  sold: boolean;
};

export type NightLootSummary = {
  won: boolean;
  night: number;
  headline: string;
  flavor: string;
  goldEarned: number;
  goldTotal: number;
  goldEarnedText: string;
  goldTotalText: string;
  items: NightLootSummaryItem[];
  emptyLootText: string | null;
  soldCount: number;
  soldGold: number;
  soldNote: string | null;
  wallHp: number;
  wallHpMax: number;
  wallDamage: number;
  wallText: string;
  wallRatio: number;
  wallFill: number;
};

/** Gold paid for a campaign night (full reward on a win, a quarter on a loss). */
export function campaignNightGoldEarned(
  won: boolean,
  rewardGold: number,
): number {
  return won ? rewardGold : Math.floor(rewardGold * 0.25);
}

/** Wall HP left after the night, including the win wear penalty. */
export function campaignNightFinalWallHp(won: boolean, wallHp: number): number {
  const penalty = won ? CAMPAIGN_WIN_WALL_PENALTY : 0;
  return Math.max(0, Math.floor(wallHp) - penalty);
}

/** Green / amber / red fill for the remaining-wall bar. */
export function wallHpBarFill(ratio: number): number {
  if (ratio <= 0.25) return 0xf87171;
  if (ratio <= 0.5) return 0xfbbf24;
  return 0x4ade80;
}

/** Note shown when the bag was full and overflow drops were sold. */
export function soldLootNote(
  soldCount: number,
  soldGold: number,
): string | null {
  if (soldCount <= 0) return null;
  const n = soldCount === 1 ? "1 item" : `${soldCount} items`;
  return `${n} auto-sold because the bag was full (${soldGold} gold)`;
}

/** Enter / Space (and numpad Enter) go back to town; key repeat is ignored. */
export function isNightSummaryReturnKey(event: {
  repeat?: boolean;
  code?: string;
  key?: string;
}): boolean {
  if (event.repeat) return false;
  return (
    event.code === "Enter" ||
    event.code === "NumpadEnter" ||
    event.code === "Space" ||
    event.key === "Enter" ||
    event.key === " "
  );
}

export type AssembleNightLootSummaryInput = {
  won: boolean;
  night: number;
  goldEarned: number;
  goldTotal: number;
  wallHp: number;
  wallHpMax: number;
  wallDamage: number;
  drops: readonly ItemDraft[];
  soldCount: number;
  soldGold: number;
  bagFreeSlots: number;
  catalog: GearCatalog;
};

/** Build the campaign night-end summary from already-applied gold, drops and wall HP. */
export function assembleNightLootSummary(
  input: AssembleNightLootSummaryInput,
): NightLootSummary {
  const items: NightLootSummaryItem[] = [];
  for (const [i, draft] of input.drops.entries()) {
    const resolved = resolveItem(input.catalog, { ...draft, uid: 0 });
    if (!resolved) continue;
    items.push({
      name: resolved.name,
      rarityLabel: resolved.rarity.label,
      color: resolved.rarity.color,
      sold: i >= input.bagFreeSlots,
    });
  }
  const max = Math.max(0, Math.floor(input.wallHpMax));
  const hp = Math.max(0, Math.floor(input.wallHp));
  const wallRatio = max <= 0 ? 0 : Math.min(1, hp / max);
  return {
    won: input.won,
    night: input.night,
    headline: input.won
      ? `Night ${input.night} defended!`
      : `Night ${input.night} lost`,
    flavor: input.won
      ? "Dawn breaks over the settlement."
      : "Scouts recover what they can.",
    goldEarned: input.goldEarned,
    goldTotal: input.goldTotal,
    goldEarnedText: `+${input.goldEarned} gold`,
    goldTotalText: `${input.goldTotal} gold`,
    items,
    emptyLootText: items.length === 0 ? "No loot this night." : null,
    soldCount: input.soldCount,
    soldGold: input.soldGold,
    soldNote: soldLootNote(input.soldCount, input.soldGold),
    wallHp: hp,
    wallHpMax: max,
    wallDamage: input.wallDamage,
    wallText: `${hp} / ${max} HP`,
    wallRatio,
    wallFill: wallHpBarFill(wallRatio),
  };
}

export type CampaignNightEndResolution = {
  result: NightResult;
  save: SaveGame;
  soldGold: number;
  soldCount: number;
  summary: NightLootSummary;
};

export type ResolveCampaignNightEndInput = {
  won: boolean;
  wallHp: number;
  wallHpStart: number;
  rewardGold: number;
  save: SaveGame;
  drops: readonly ItemDraft[];
  catalog: GearCatalog;
  loot?: LootConfig;
};

/**
 * Apply a campaign night's gold, drops and wall damage and build the summary
 * shown on the loot panel (endless / planner runs do not use this).
 */
export function resolveCampaignNightEnd(
  input: ResolveCampaignNightEndInput,
): CampaignNightEndResolution {
  const loot = input.loot ?? getLootConfig();
  const finalWallHp = campaignNightFinalWallHp(input.won, input.wallHp);
  const wallDamage = input.wallHpStart - finalWallHp;
  const goldEarned = campaignNightGoldEarned(input.won, input.rewardGold);
  const result: NightResult = {
    won: input.won,
    goldEarned,
    wallDamage,
    night: input.save.night,
    drops: [...input.drops],
  };
  const bagFreeSlots = Math.max(
    0,
    loot.inventoryCapacity - bagItems(input.save.gear).length,
  );
  const applied = applyNightResultDetailed(
    input.save,
    result,
    input.catalog,
    loot,
  );
  const next: SaveGame = { ...applied.save, townWallHp: finalWallHp };
  return {
    result,
    save: next,
    soldGold: applied.soldGold,
    soldCount: applied.soldCount,
    summary: assembleNightLootSummary({
      won: input.won,
      night: result.night,
      goldEarned,
      goldTotal: next.gold,
      wallHp: finalWallHp,
      wallHpMax: input.save.townWallHpMax,
      wallDamage,
      drops: input.drops,
      soldCount: applied.soldCount,
      soldGold: applied.soldGold,
      bagFreeSlots,
      catalog: input.catalog,
    }),
  };
}
