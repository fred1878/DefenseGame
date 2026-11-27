import { RARITY_IDS, type RarityId } from "../../gear/gearTypes";
import { createBaseItem } from "../../gear/itemGen";
import { offerPrice } from "../../gear/shops";
import type { SimData } from "./simData";
import {
  emptyRarityCounts,
  type NightRecord,
  type RarityCounts,
  type RunResult,
  type StrategyId,
} from "./simulate";

export type Percentiles = { p10: number; p50: number; p90: number };

/** Nearest-rank percentile of a list (0 for an empty list). */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1));
  return s[idx]!;
}

export function percentiles(values: readonly number[]): Percentiles {
  return {
    p10: percentile(values, 0.1),
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
  };
}

/** Per-night metrics pulled from the record that ended each night. */
export const NIGHT_METRICS = {
  goldEarned: (r: NightRecord) => r.goldEarned,
  salesGold: (r: NightRecord) => r.salesGold,
  spentWall: (r: NightRecord) => r.spentWall,
  spentGear: (r: NightRecord) => r.spentGear,
  spentConsumables: (r: NightRecord) => r.spentConsumables,
  spentShops: (r: NightRecord) => r.spentShops,
  spentRerolls: (r: NightRecord) => r.spentRerolls,
  requestGold: (r: NightRecord) => r.requestGold,
  traderLevel: (r: NightRecord) => r.traderLevel,
  blacksmithLevel: (r: NightRecord) => r.blacksmithLevel,
  goldBanked: (r: NightRecord) => r.goldBanked,
  wallLevel: (r: NightRecord) => r.wallLevel,
  avgItemLevel: (r: NightRecord) => r.avgItemLevel,
  equippedCount: (r: NightRecord) => r.equippedCount,
  weaponDps: (r: NightRecord) => r.powerAfter.weaponDps,
  offenceDps: (r: NightRecord) => r.powerAfter.offenceDps,
  ehp: (r: NightRecord) => r.powerAfter.ehp,
  spellPowerPct: (r: NightRecord) => r.powerAfter.spellPowerPct,
  attackSpeedPct: (r: NightRecord) => r.powerAfter.attackSpeedPct,
  armour: (r: NightRecord) => r.powerAfter.armour,
  powerRatio: (r: NightRecord) => r.pressure.powerRatio,
  offenceRatio: (r: NightRecord) => r.pressure.offenceRatio,
  defenceRatio: (r: NightRecord) => r.pressure.defenceRatio,
  wallRatio: (r: NightRecord) => r.pressure.wallRatio,
  winChance: (r: NightRecord) => r.pressure.winChance,
  bagCount: (r: NightRecord) => r.bagCount,
  shopAffordablePct: (r: NightRecord) =>
    r.shopItems ? (100 * r.shopAffordable) / r.shopItems : 0,
  traderMedianPrice: (r: NightRecord) => r.traderMedianPrice,
  equippedFromDrops: (r: NightRecord) => r.equippedFromDrops,
  equippedFromShop: (r: NightRecord) => r.equippedFromShop,
  equippedFromTrader: (r: NightRecord) => r.equippedFromTrader,
  stages: (r: NightRecord) => r.stages,
  stageWon: (r: NightRecord) => r.stageWon,
  /** Share of the night's spawn groups survived (0..1). */
  stageProgress: (r: NightRecord) => (r.stages > 0 ? r.stageWon / r.stages : 0),
  hpLeft: (r: NightRecord) => r.hpLeft,
  wallLeft: (r: NightRecord) => r.wallLeft,
  /** Gold on hand entering town ÷ median shop price (1 = a typical item). */
  purchasingPower: (r: NightRecord) => r.purchasingPower,
  shopMedianPrice: (r: NightRecord) => r.shopMedianPrice,
  /** Gold short of the next upgrade (0 outside a deficit night). */
  deficitGold: (r: NightRecord) => r.deficitGold,
  /** Score the strategy could not buy on a deficit night. */
  forgoneScore: (r: NightRecord) => r.forgoneScore,
} as const;
export type NightMetric = keyof typeof NIGHT_METRICS;

export type NightFlag = "too easy" | "too hard" | "";

export type NightAggregate = {
  night: number;
  /** Share of runs that reached (played) this night. */
  reachedPct: number;
  /** Average losses on this night per run that reached it. */
  lossesPerRun: number;
  /** Average auto-sold drops (full bag) on this night per run. */
  autoSoldPerRun: number;
  /** Average consumables used on this night per run. */
  consumablesPerRun: number;
  /** Average buy-request gold on this night per run (all attempts). */
  requestGoldPerRun: number;
  /** Share of runs reaching this night whose next upgrade was unaffordable, %. */
  deficitPct: number;
  metrics: Record<NightMetric, Percentiles>;
  /** Average equipped items of each rarity after this night. */
  equippedRarity: RarityCounts;
  flag: NightFlag;
  enemyHp: number;
  enemyDamage: number;
  rewardGold: number;
};

export type StrategySummary = {
  strategy: StrategyId;
  runs: number;
  finishedPct: number;
  nightsPlayed: Percentiles;
  losses: Percentiles;
  totalEarned: Percentiles;
  totalSales: Percentiles;
  totalSpentWall: Percentiles;
  totalSpentGear: Percentiles;
  totalSpentConsumables: Percentiles;
  totalSpentShops: Percentiles;
  totalSpentRerolls: Percentiles;
  rerolls: Percentiles;
  /** Trader buy requests over the run: gold paid and requests filled. */
  totalRequestGold: Percentiles;
  requestsFilled: Percentiles;
  /** Mean buy-request gold per run (the median is often 0). */
  requestGoldMean: number;
  /** Requests filled ÷ requests posted, %. */
  requestFillPct: number;
  /** Mean gold per filled request. */
  requestGoldPerFill: number;
  finalTraderLevel: Percentiles;
  finalBlacksmithLevel: Percentiles;
  /** Nights whose median power ratio is flagged too easy / too hard. */
  easyNights: number[];
  hardNights: number[];
  finalGold: Percentiles;
  finalAvgItemLevel: Percentiles;
  finalPowerRatio: Percentiles;
  autoSold: Percentiles;
  /** Share of town phases where the next upgrade cost more than the gold on hand, %. */
  deficitPct: number;
  /** Mean gold short of the next upgrade on deficit nights. */
  deficitGoldMean: number;
  /** Mean score forgone per deficit night (counterfactual purchase). */
  forgoneScoreMean: number;
  /** Share of losses that fell in the night's last spawn group, %. */
  lateLossPct: number;
  /** Gold ÷ median shop price on entering town (1 = a typical item). */
  purchasingPower: Percentiles;
  /** Share of equipped items at the end that came from drops (vs shops). */
  finalFromDropsPct: number;
  /** Share of equipped items at the end bought from the trader / blacksmith. */
  finalFromTraderPct: number;
  finalFromBlacksmithPct: number;
  dropRarity: RarityCounts;
  finalEquippedRarity: RarityCounts;
  nights: NightAggregate[];
};

export type FlagThresholds = { easy: number; hard: number };

export const DEFAULT_FLAGS: FlagThresholds = { easy: 2, hard: 1 };

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

function addCounts(into: RarityCounts, from: RarityCounts, scale = 1): void {
  for (const r of RARITY_IDS) into[r] += from[r] * scale;
}

/** Collapse many runs of one strategy into percentiles per night and per run. */
export function aggregateRuns(
  strategy: StrategyId,
  runs: readonly RunResult[],
  data: SimData,
  flags: FlagThresholds = DEFAULT_FLAGS,
): StrategySummary {
  const n = Math.max(1, runs.length);
  const nights: NightAggregate[] = [];
  for (const diff of data.nights) {
    const finals: NightRecord[] = [];
    let losses = 0;
    let autoSold = 0;
    let consumables = 0;
    let requestGold = 0;
    let deficit = 0;
    for (const run of runs) {
      const recs = run.records.filter((r) => r.night === diff.night);
      if (!recs.length) continue;
      const final = recs[recs.length - 1]!;
      finals.push(final);
      if (final.deficit) deficit += 1;
      losses += recs.filter((r) => !r.won).length;
      autoSold += sum(recs.map((r) => r.autoSold));
      consumables += sum(recs.map((r) => r.consumablesUsed));
      requestGold += sum(recs.map((r) => r.requestGold));
    }
    const reached = Math.max(1, finals.length);
    const metrics = Object.fromEntries(
      Object.entries(NIGHT_METRICS).map(([k, f]) => [
        k,
        percentiles(finals.map(f)),
      ]),
    ) as Record<NightMetric, Percentiles>;
    const equippedRarity = emptyRarityCounts();
    for (const f of finals)
      addCounts(equippedRarity, f.equippedRarity, 1 / reached);
    const ratio = metrics.powerRatio.p50;
    nights.push({
      night: diff.night,
      reachedPct: (100 * finals.length) / n,
      lossesPerRun: losses / reached,
      autoSoldPerRun: autoSold / reached,
      consumablesPerRun: consumables / reached,
      requestGoldPerRun: requestGold / reached,
      deficitPct: (100 * deficit) / reached,
      metrics,
      equippedRarity,
      flag: !finals.length
        ? ""
        : ratio >= flags.easy
          ? "too easy"
          : ratio < flags.hard
            ? "too hard"
            : "",
      enemyHp: diff.totalHp,
      enemyDamage: diff.totalDamage,
      rewardGold: diff.rewardGold,
    });
  }
  const per = (f: (run: RunResult) => number) => percentiles(runs.map(f));
  const total = (pick: (r: NightRecord) => number) => (run: RunResult) =>
    sum(run.records.map(pick));
  const last = (run: RunResult) => run.records[run.records.length - 1];
  const dropRarity = emptyRarityCounts();
  const finalEquippedRarity = emptyRarityCounts();
  let fromDrops = 0;
  let fromTrader = 0;
  let fromShop = 0;
  let equippedTotal = 0;
  let requestGoldAll = 0;
  let filledAll = 0;
  let postedAll = 0;
  let recordCount = 0;
  let deficitCount = 0;
  let deficitGoldSum = 0;
  let forgoneSum = 0;
  let lossCount = 0;
  let lateLosses = 0;
  for (const run of runs) {
    for (const r of run.records) {
      recordCount += 1;
      if (r.deficit) {
        deficitCount += 1;
        deficitGoldSum += r.deficitGold;
        forgoneSum += r.forgoneScore;
      }
      if (!r.won) {
        lossCount += 1;
        if (r.stages > 1 && r.failedStage === r.stages - 1) lateLosses += 1;
      }
    }
    for (const r of run.records) {
      requestGoldAll += r.requestGold;
      filledAll += r.requestsFilled;
      postedAll += r.requestsPosted;
    }
    for (const r of run.records) addCounts(dropRarity, r.dropRarity);
    const l = last(run);
    if (l) {
      addCounts(finalEquippedRarity, l.equippedRarity, 1 / n);
      fromDrops += l.equippedFromDrops;
      fromTrader += l.equippedFromTrader;
      fromShop += l.equippedFromShop;
      equippedTotal += l.equippedCount;
    }
  }
  return {
    strategy,
    runs: runs.length,
    deficitPct: recordCount ? (100 * deficitCount) / recordCount : 0,
    deficitGoldMean: deficitCount ? deficitGoldSum / deficitCount : 0,
    forgoneScoreMean: deficitCount ? forgoneSum / deficitCount : 0,
    lateLossPct: lossCount ? (100 * lateLosses) / lossCount : 0,
    purchasingPower: percentiles(
      runs.flatMap((r) => r.records.map((x) => x.purchasingPower)),
    ),
    finishedPct: (100 * runs.filter((r) => r.finished).length) / n,
    nightsPlayed: per((r) => r.records.length),
    losses: per((r) => r.records.filter((x) => !x.won).length),
    totalEarned: per(total((r) => r.goldEarned)),
    totalSales: per(total((r) => r.salesGold)),
    totalSpentWall: per(total((r) => r.spentWall)),
    totalSpentGear: per(total((r) => r.spentGear)),
    totalSpentConsumables: per(total((r) => r.spentConsumables)),
    totalSpentShops: per(total((r) => r.spentShops)),
    totalSpentRerolls: per(total((r) => r.spentRerolls)),
    rerolls: per(total((r) => r.rerolls)),
    totalRequestGold: per(total((r) => r.requestGold)),
    requestsFilled: per(total((r) => r.requestsFilled)),
    requestGoldMean: requestGoldAll / n,
    requestFillPct: postedAll ? (100 * filledAll) / postedAll : 0,
    requestGoldPerFill: filledAll ? requestGoldAll / filledAll : 0,
    finalTraderLevel: per((r) => last(r)?.traderLevel ?? 0),
    finalBlacksmithLevel: per((r) => last(r)?.blacksmithLevel ?? 0),
    easyNights: nights.filter((x) => x.flag === "too easy").map((x) => x.night),
    hardNights: nights.filter((x) => x.flag === "too hard").map((x) => x.night),
    finalGold: per((r) => last(r)?.goldBanked ?? 0),
    finalAvgItemLevel: per((r) => last(r)?.avgItemLevel ?? 0),
    finalPowerRatio: per((r) => last(r)?.pressure.powerRatio ?? 0),
    autoSold: per(total((r) => r.autoSold)),
    finalFromDropsPct: equippedTotal ? (100 * fromDrops) / equippedTotal : 0,
    finalFromTraderPct: equippedTotal ? (100 * fromTrader) / equippedTotal : 0,
    finalFromBlacksmithPct: equippedTotal
      ? (100 * (fromShop - fromTrader)) / equippedTotal
      : 0,
    dropRarity,
    finalEquippedRarity,
    nights,
  };
}

export type PriceRow = {
  shop: "blacksmith";
  name: string;
  unlockNight: number;
  price: number;
  /** Median gold earned on the unlock night (one night's pay). */
  nightReward: number;
  /** Price ÷ that night's reward: nights of pay to buy it. */
  nightsOfPay: number;
};

/** Blacksmith catalogue prices vs the reward of the night they unlock. */
export function blacksmithPriceTable(data: SimData): PriceRow[] {
  const rows: PriceRow[] = [];
  const ctx = {
    catalog: data.catalog,
    consumables: data.consumables,
    shops: data.shops,
    loot: data.loot,
  };
  for (const entry of data.shops.blacksmith.items) {
    const base = data.catalog.bases[entry.baseId];
    if (!base) continue;
    const item = createBaseItem(data.catalog, entry.baseId, 1);
    const price = offerPrice(ctx, "blacksmith", {
      kind: "item",
      item,
      qty: null,
    })!;
    const reward =
      data.nights.find((d) => d.night === entry.unlockNight)?.rewardGold ?? 0;
    rows.push({
      shop: "blacksmith",
      name: base.name,
      unlockNight: entry.unlockNight,
      price,
      nightReward: reward,
      nightsOfPay: reward ? price / reward : Number.POSITIVE_INFINITY,
    });
  }
  return rows.sort(
    (a, b) => a.unlockNight - b.unlockNight || a.price - b.price,
  );
}

export function rarityShares(counts: RarityCounts): Record<RarityId, number> {
  const total = sum(RARITY_IDS.map((r) => counts[r]));
  return Object.fromEntries(
    RARITY_IDS.map((r) => [r, total ? (100 * counts[r]) / total : 0]),
  ) as Record<RarityId, number>;
}
