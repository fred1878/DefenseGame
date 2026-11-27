import type { DataStore } from "../../core/data/DataStore";
import { createNewSave, prepareDefenseNight } from "../../core/save/GameState";
import type { SaveGame } from "../../core/save/saveTypes";
import type { TownBuildingDef } from "../../core/data/townBuildingTypes";
import { consumableCount } from "../../gear/consumables";
import {
  EQUIP_SLOTS,
  RARITY_IDS,
  type EquipSlot,
  type RarityId,
  type SaveGear,
} from "../../gear/gearTypes";
import { addItem, bagItems, equipItem, removeItem } from "../../gear/inventory";
import { equipSlotsForType, type ItemDraft } from "../../gear/itemGen";
import { resolveItem, sellValue } from "../../gear/itemStats";
import { rollNightDrops } from "../../gear/loot";
import { resolveCampaignNightEnd } from "../../gear/nightLootSummary";
import { createRng, type Rng } from "../../gear/rng";
import {
  requestMatches,
  requestMatchesInBag,
  requestPayout,
} from "../../gear/buyRequests";
import {
  buyOffer,
  ensureShopStock,
  fillTraderRequest,
  offerPrice,
  rerollTrader,
  SHOP_IDS,
  shopLevel,
  shopOffers,
  traderAt,
  type ShopContext,
  type ShopId,
} from "../../gear/shops";
import {
  handleTownBuildingTap,
  upgradeShop,
} from "../../systems/townBuildingMenu";
import {
  DEFAULT_POWER_MODEL,
  nightPressure,
  playerPower,
  type ConsumableBoost,
  type NightPressure,
  type PlayerPower,
  type PowerModel,
} from "./power";
import { resolveNightStages, type NightOutcome } from "./stages";
import type { NightDifficulty, SimData } from "./simData";
import {
  canLearn,
  learnTalent,
  pointsAvailable,
  talentBonus,
} from "../../talents/talentLogic";
import type { SaveTalents } from "../../talents/talentTypes";

export const STRATEGY_IDS = [
  "walls-first",
  "gear-first",
  "balanced",
  "potion-hoarder",
  "no-spend",
  "melee-dps",
  "ranged",
  "spell-caster",
  "tank",
  "sustain",
  "wall-turtle",
  "shop-investor",
  "reroller",
  "saver",
  "lookahead",
  "adaptive",
  "request-flipper",
  "hybrid",
] as const;
export type StrategyId = (typeof STRATEGY_IDS)[number];

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  "walls-first": "Walls first, then gear; spare gold into shop upgrades",
  "gear-first": "Gear first, then walls; spare gold into shop upgrades",
  balanced:
    "Best upgrade per gold (walls + gear); spare gold into shop upgrades",
  "potion-hoarder": "Fill potions/bombs, then best upgrade per gold",
  "no-spend": "Never buy (drops only)",
  "melee-dps":
    "Balanced, but gear picks favour melee DPS (weapon, attack speed)",
  ranged: "Balanced, but gear picks favour ranged DPS",
  "spell-caster":
    "Balanced, but gear picks favour spell power / element boosts",
  tank: "Balanced, but gear picks favour effective HP (armour, HP)",
  sustain: "Balanced, but gear picks favour lifesteal",
  "wall-turtle": "Walls first, then armour/HP gear",
  "shop-investor": "Shop upgrades first (cheapest level), then balanced",
  reroller:
    "Trader upgrade first, balanced, then rerolls trader stock (≤3/day)",
  saver: "Balanced, but only buys rare-or-better gear; hoards for quality",
  lookahead: "Balanced, weighing this night and the next when picking upgrades",
  adaptive:
    "Balanced, chasing whichever of offence / defence is currently behind",
  "request-flipper":
    "Balanced, then buys shop items that fill a trader buy request at a profit",
  hybrid:
    "Walls to level 5, then best-per-gold, then shop levels and trader rerolls",
};

type SpendPlan =
  | "walls-first"
  | "gear-first"
  | "balanced"
  | "potions"
  | "none"
  | "investor"
  | "reroller"
  | "hybrid";

type Profile = {
  plan: SpendPlan;
  /** Gear focus metric; gear score = power ratio × (metric / metric with no gear). */
  focus?: (p: PlayerPower, pressure: NightPressure) => number;
  /** Put gold left after the plan into shop upgrades. */
  spareToShops: boolean;
  /**
   * Talent branch ids to fill in order (best-scoring learnable node inside the
   * first branch with one); unset = best-scoring node anywhere in the tree.
   */
  talentBranches?: string[];
  /** Only buy gear at or above this rarity (a saver hoards for quality). */
  minRarity?: RarityId;
  /** Weigh the next N nights' difficulty as well as the coming one. */
  lookahead?: number;
  /** Buy shop items that match a trader buy request when it turns a profit. */
  flipRequests?: boolean;
};

const PROFILES: Record<StrategyId, Profile> = {
  "walls-first": { plan: "walls-first", spareToShops: true },
  "gear-first": { plan: "gear-first", spareToShops: true },
  balanced: { plan: "balanced", spareToShops: true },
  "potion-hoarder": { plan: "potions", spareToShops: false },
  "no-spend": { plan: "none", spareToShops: false },
  "melee-dps": {
    plan: "balanced",
    focus: (p) => p.meleeDps,
    spareToShops: true,
    talentBranches: ["blade"],
  },
  ranged: {
    plan: "balanced",
    focus: (p) => p.rangedDps,
    spareToShops: true,
    talentBranches: ["marksman"],
  },
  "spell-caster": {
    plan: "balanced",
    focus: (p) => p.spellMult,
    spareToShops: true,
    talentBranches: ["sorcery"],
  },
  tank: {
    plan: "balanced",
    focus: (p) => p.ehp,
    spareToShops: true,
    talentBranches: ["blade"],
  },
  sustain: {
    plan: "balanced",
    focus: (p) => 1 + p.lifestealPct / 10,
    spareToShops: true,
    talentBranches: ["blade"],
  },
  "wall-turtle": {
    plan: "walls-first",
    focus: (p) => p.ehp,
    spareToShops: false,
    talentBranches: ["blade"],
  },
  "shop-investor": { plan: "investor", spareToShops: true },
  reroller: { plan: "reroller", spareToShops: true },
  saver: { plan: "balanced", spareToShops: true, minRarity: "rare" },
  lookahead: { plan: "balanced", spareToShops: true, lookahead: 1 },
  adaptive: {
    plan: "balanced",
    spareToShops: true,
    focus: (p, pressure) =>
      pressure.defenceRatio < pressure.offenceRatio ? p.ehp : p.offenceDps,
  },
  "request-flipper": {
    plan: "balanced",
    spareToShops: true,
    flipRequests: true,
  },
  hybrid: { plan: "hybrid", spareToShops: true },
};

/** Trader rerolls a reroller makes per town visit at most. */
const MAX_REROLLS_PER_DAY = 3;

/** Wall levels a hybrid buys before switching to best-per-gold. */
const HYBRID_WALL_LEVELS = 5;

// ---------- RNG streams ----------

/** Independent random streams a night draws from. */
export type NightStreams = {
  /** Night outcome (stage rolls, or the single fixed-model roll). */
  win: Rng;
  /** Loot rolls. */
  drops: Rng;
  /** Shop stock and buy requests. */
  shops: Rng;
  /** Trader rerolls. */
  rerolls: Rng;
};

export type StreamId = keyof NightStreams;

const STREAM_CODE: Record<StreamId, number> = {
  win: 1,
  drops: 2,
  shops: 3,
  rerolls: 4,
};

/** splitmix32 finaliser. */
function mix32(x: number): number {
  let h = (x + 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Seed of one subsystem's stream for one night attempt. Streams are derived
 * from (seed, subsystem, night, attempt) rather than drawn from a shared
 * generator, so shop luck cannot shift the win rolls (and the other way
 * around) — the same seed gives every strategy the same run of night luck.
 */
export function streamSeed(
  seed: number,
  stream: StreamId,
  night: number,
  attempt: number,
): number {
  const tagged = mix32(seed ^ Math.imul(STREAM_CODE[stream], 0x27d4eb2d));
  return mix32(tagged ^ mix32(Math.imul(night, 0x165667b1) + attempt));
}

/** The four streams one night attempt draws from. */
export function nightStreams(
  seed: number,
  night: number,
  attempt: number,
): NightStreams {
  return {
    win: createRng(streamSeed(seed, "win", night, attempt)),
    drops: createRng(streamSeed(seed, "drops", night, attempt)),
    shops: createRng(streamSeed(seed, "shops", night, attempt)),
    rerolls: createRng(streamSeed(seed, "rerolls", night, attempt)),
  };
}

// ---------- options and records ----------

export type WinModel = "power" | "fixed";

export type SimOptions = {
  strategy: StrategyId;
  winModel: WinModel;
  /** Win chance per night for `fixed`. */
  winRate: number;
  /** Nights to win for a finished campaign (default: every night in waves.json). */
  nights: number;
  /** Give up after this many nights played (wins + losses). */
  maxAttempts: number;
  /** Sell bag items that are not upgrades at the sell-back rate. */
  sellSurplus: boolean;
  /** Spend carried consumables when the night's win chance is below this. */
  consumableUseBelow: number;
  /** Spend talent points each town phase (false = never learn talents). */
  talents: boolean;
  model: PowerModel;
  /**
   * Called before each night is resolved with the save the night starts from
   * (win-model validation exports these and replays them in the real game).
   */
  onNightStart?: (save: SaveGame, pressure: NightPressure) => void;
};

export function defaultSimOptions(data: SimData): SimOptions {
  return {
    strategy: "balanced",
    winModel: "power",
    winRate: 0.85,
    nights: data.nights.length,
    maxAttempts: data.nights.length * 4,
    sellSurplus: true,
    consumableUseBelow: 0.75,
    talents: true,
    model: DEFAULT_POWER_MODEL,
  };
}

export type RarityCounts = Record<RarityId, number>;

export type FailedOn = "offence" | "defence" | "wall";

export type NightRecord = {
  night: number;
  /** 1-based count of nights played so far in this run. */
  attempt: number;
  won: boolean;
  pressure: NightPressure;
  /** Power as the night was played (before town spending). */
  power: PlayerPower;
  consumablesUsed: number;
  goldEarned: number;
  /** Bag items sold by the strategy plus drops auto-sold on a full bag. */
  salesGold: number;
  spentWall: number;
  spentGear: number;
  spentConsumables: number;
  /** Shop upgrade levels bought this night. */
  spentShops: number;
  spentRerolls: number;
  rerolls: number;
  /** Gold from trader buy requests filled this night (150% sales). */
  requestGold: number;
  requestsFilled: number;
  /** Buy requests posted this night. */
  requestsPosted: number;
  traderLevel: number;
  blacksmithLevel: number;
  /** Gold left after the town phase. */
  goldBanked: number;
  wallLevel: number;
  wallHpMax: number;
  drops: number;
  dropRarity: RarityCounts;
  autoSold: number;
  bagCount: number;
  bagCapacity: number;
  shopItems: number;
  /** Shop gear offers (trader + blacksmith) priced at or under the gold on hand when entering town. */
  shopAffordable: number;
  /** Median price of every shop gear offer on entering town. */
  shopMedianPrice: number;
  /** Gold on hand ÷ median shop price (1 = can afford a typical item). */
  purchasingPower: number;
  /** The best available upgrade cost more than the gold on hand entering town. */
  deficit: boolean;
  /** How much more gold that upgrade needed (0 outside a deficit night). */
  deficitGold: number;
  /** Score of the best upgrade the strategy could not afford (counterfactual purchase). */
  forgoneScore: number;
  traderMedianPrice: number;
  equippedCount: number;
  avgItemLevel: number;
  equippedRarity: RarityCounts;
  equippedFromDrops: number;
  equippedFromShop: number;
  /** Of the shop items: bought from the trader (the rest came from the blacksmith). */
  equippedFromTrader: number;
  /** Power after the town phase (going into the next night). */
  powerAfter: PlayerPower;
  /** Spawn groups the night was resolved in (1 for the fixed win model). */
  stages: number;
  /** Spawn groups survived before the night ended. */
  stageWon: number;
  /** 0-based index of the spawn group that broke the player (losses only). */
  failedStage: number | null;
  /** Resource the night was lost on (fixed model: null). */
  failedOn: FailedOn | null;
  /** Share of the night's defence budget left after the last stage. */
  hpLeft: number;
  /** Share of the wall's HP left after the last stage. */
  wallLeft: number;
};

export type RunResult = {
  seed: number;
  finished: boolean;
  records: NightRecord[];
  /** Talent ranks learned by the end of the run. */
  talents?: SaveTalents;
};

export function emptyRarityCounts(): RarityCounts {
  return Object.fromEntries(RARITY_IDS.map((r) => [r, 0])) as RarityCounts;
}

const WALL_BUILDING: TownBuildingDef = {
  label: "Wall",
  width: 0,
  height: 0,
  upgradeId: "wall",
};

/** A gear row in a shop, priced for the shop's current level. */
export type GearOffer = {
  shop: ShopId;
  index: number;
  price: number;
  rarity: RarityId;
  item: ItemDraft;
};

/** A gear offer that would raise the score, with the gain it buys. */
export type GearUpgrade = GearOffer & { gain: number; gainPerGold: number };

/** An upgrade the town offers: what it buys and what it costs. */
export type UpgradeOption = {
  kind: "gear" | "wall";
  cost: number;
  gain: number;
};

/** Mutable state of one simulated campaign. */
class Run {
  save: SaveGame;
  readonly origin = new Map<number, "drop" | ShopId>();
  readonly shopCtx: ShopContext;
  private readonly store: DataStore;
  readonly profile: Profile;
  private readonly focusBase: number;
  streams: NightStreams = nightStreams(0, 1, 1);
  spent = emptySpend();
  rerolls = 0;
  salesGold = 0;
  requestGold = 0;
  requestsFilled = 0;
  /** Memoised power / score by object identity: the sim asks for the same
   *  gear thousands of times per night (every candidate purchase). */
  private readonly powerCache = new WeakMap<
    SaveGear,
    { talents: SaveTalents; power: PlayerPower }
  >();
  private readonly scoreCache = new WeakMap<
    SaveGear,
    Array<{ talents: SaveTalents; night: number; wall: number; value: number }>
  >();

  constructor(
    readonly data: SimData,
    readonly opts: SimOptions,
  ) {
    this.save = createNewSave();
    this.shopCtx = {
      catalog: data.catalog,
      consumables: data.consumables,
      shops: data.shops,
      loot: data.loot,
    };
    this.store = { buildings: data.buildings } as unknown as DataStore;
    this.profile = PROFILES[opts.strategy];
    const empty: SaveGear = { items: [], equipped: {}, nextUid: 1 };
    const emptyPower = this.power(empty);
    const emptyPressure = nightPressure(
      emptyPower,
      this.difficulty(),
      this.save.townWallHpMax,
      opts.model,
    );
    this.focusBase = Math.max(
      1e-6,
      this.profile.focus?.(emptyPower, emptyPressure) ?? 1,
    );
  }

  /** The night `offset` nights after the coming one (clamped to the campaign). */
  difficultyAt(offset = 0): NightDifficulty {
    const nights = this.data.nights;
    const idx = Math.min(nights.length, Math.max(1, this.save.night + offset));
    return nights[Math.max(0, Math.min(nights.length - 1, idx - 1))]!;
  }

  difficulty(): NightDifficulty {
    return this.difficultyAt(0);
  }

  power(
    gear: SaveGear = this.save.gear,
    talents: SaveTalents = this.save.talents,
  ): PlayerPower {
    const hit = this.powerCache.get(gear);
    if (hit && hit.talents === talents) return hit.power;
    const power = playerPower(
      this.data.catalog,
      gear,
      this.opts.model,
      talentBonus(this.data.talents, talents),
    );
    this.powerCache.set(gear, { talents, power });
    return power;
  }

  /** Gear / wall choice score: power ratio, tilted toward the profile's focus stat. */
  score(
    gear: SaveGear,
    wallHpMax = this.save.townWallHpMax,
    talents: SaveTalents = this.save.talents,
  ): number {
    const cached = this.scoreCache.get(gear);
    const night = this.save.night;
    const hit = cached?.find(
      (e) => e.talents === talents && e.night === night && e.wall === wallHpMax,
    );
    if (hit) return hit.value;
    const value = this.computeScore(gear, wallHpMax, talents);
    const entry = { talents, night, wall: wallHpMax, value };
    if (cached) cached.push(entry);
    else this.scoreCache.set(gear, [entry]);
    return value;
  }

  private computeScore(
    gear: SaveGear,
    wallHpMax: number,
    talents: SaveTalents,
  ): number {
    const power = this.power(gear, talents);
    const pressureAt = (offset: number) =>
      nightPressure(
        power,
        this.difficultyAt(offset),
        wallHpMax,
        this.opts.model,
      );
    const here = pressureAt(0);
    let ratio = here.powerRatio;
    if (this.profile.lookahead) {
      const later = pressureAt(this.profile.lookahead).powerRatio;
      ratio = Math.sqrt(Math.max(0, ratio) * Math.max(0, later));
    }
    const focus = this.profile.focus;
    if (!focus) return ratio;
    return ratio * (Math.max(0, focus(power, here)) / this.focusBase);
  }

  /** Learnable talent ids, limited to the profile's first open branch. */
  talentCandidates(): string[] {
    const tree = this.data.talents;
    const t = this.save.talents;
    const open = (ids: string[]) => ids.filter((id) => canLearn(tree, t, id));
    const idsIn = (branchId?: string) =>
      tree.branches
        .filter((b) => branchId === undefined || b.id === branchId)
        .flatMap((b) => b.tiers.flatMap((tier) => tier.nodes.map((n) => n.id)));
    for (const branchId of this.profile.talentBranches ?? []) {
      const ids = open(idsIn(branchId));
      if (ids.length) return ids;
    }
    return open(idsIn());
  }

  /** Spend every talent point, one rank at a time, on the best-scoring node. */
  allocateTalents(): void {
    if (!this.opts.talents) return;
    for (let guard = 0; guard < 200; guard++) {
      if (pointsAvailable(this.save.talents) < 1) return;
      const candidates = this.talentCandidates();
      let best: { talents: SaveTalents; score: number } | null = null;
      for (const id of candidates) {
        const talents = learnTalent(this.data.talents, this.save.talents, id);
        const score = this.score(this.save.gear, undefined, talents);
        if (!best || score > best.score + 1e-9) best = { talents, score };
      }
      if (!best) return;
      this.save = { ...this.save, talents: best.talents };
    }
  }

  level(shop: ShopId): number {
    return shopLevel(this.save, this.shopCtx, shop);
  }

  /** Best slot for an owned item and the score with it equipped there. */
  bestEquip(gear: SaveGear, uid: number): { gear: SaveGear; score: number } {
    const item = gear.items.find((i) => i.uid === uid)!;
    const base = this.data.catalog.bases[item.baseId]!;
    let best = { gear, score: this.score(gear) };
    for (const slot of equipSlotsForType(base.type)) {
      const next = equipItem(this.data.catalog, gear, uid, slot);
      const score = this.score(next);
      if (score > best.score + 1e-9) best = { gear: next, score };
    }
    return best;
  }

  equipUpgrades(): void {
    for (let guard = 0; guard < 40; guard++) {
      const current = this.score(this.save.gear);
      let best: { gear: SaveGear; score: number } | null = null;
      for (const item of bagItems(this.save.gear)) {
        const r = this.bestEquip(this.save.gear, item.uid);
        if (r.score > current + 1e-9 && (!best || r.score > best.score)) {
          best = r;
        }
      }
      if (!best) return;
      this.save = { ...this.save, gear: best.gear };
    }
  }

  /** Sell matching bag items to the trader's buy requests (best payout). */
  fillRequests(): void {
    const count = this.save.shops.requests?.length ?? 0;
    for (let i = count - 1; i >= 0; i--) {
      const request = this.save.shops.requests![i]!;
      const best = requestMatchesInBag(
        this.save,
        this.data.catalog,
        request,
      )[0];
      if (!best) continue;
      const r = fillTraderRequest(this.save, this.shopCtx, i);
      this.origin.delete(best.item.uid);
      this.save = r.save;
      this.requestGold += r.gold;
      this.requestsFilled += 1;
    }
  }

  sellBag(): void {
    this.fillRequests();
    for (const item of bagItems(this.save.gear)) {
      const r = resolveItem(this.data.catalog, item)!;
      const gold = sellValue(r.price, this.data.loot.sellBackPct);
      this.salesGold += gold;
      this.save = {
        ...this.save,
        gold: this.save.gold + gold,
        gear: removeItem(this.save.gear, item.uid),
      };
      this.origin.delete(item.uid);
    }
  }

  private bagFull(): boolean {
    return bagItems(this.save.gear).length >= this.data.loot.inventoryCapacity;
  }

  wallCost(): number | null {
    const def = this.data.buildings.wall;
    if (!def) return null;
    const level = wallLevel(this.save);
    if (level >= def.maxLevel) return null;
    return def.costByLevel[level] ?? null;
  }

  /** Buy one wall level through the game's own building tap handler. */
  buyWall(): boolean {
    const cost = this.wallCost();
    if (cost === null || cost > this.save.gold) return false;
    const r = handleTownBuildingTap(this.store, this.save, WALL_BUILDING);
    /* v8 ignore next -- wallCost already checked level, cost and gold */
    if (r.result.kind !== "upgraded") return false;
    this.save = r.save;
    this.spent.wall += cost;
    return true;
  }

  /** The next wall level's score gain and cost, affordable or not. */
  wallOption(): UpgradeOption | null {
    const cost = this.wallCost();
    if (cost === null) return null;
    // Probe with enough gold so the counterfactual sees unaffordable levels too.
    const probe =
      cost > this.save.gold ? { ...this.save, gold: cost } : this.save;
    const r = handleTownBuildingTap(this.store, probe, WALL_BUILDING);
    /* v8 ignore next -- wallCost already checked level and cost */
    if (r.result.kind !== "upgraded") return null;
    const gain =
      this.score(this.save.gear, r.save.townWallHpMax) -
      this.score(this.save.gear);
    if (gain <= 1e-9) return null;
    return { kind: "wall", cost, gain };
  }

  wallGainPerGold(): number {
    const option = this.wallOption();
    if (!option || option.cost > this.save.gold) return 0;
    return option.gain / option.cost;
  }

  gearOffers(): GearOffer[] {
    const out: GearOffer[] = [];
    for (const shop of ["trader", "blacksmith"] as const) {
      shopOffers(this.save, this.shopCtx, shop).forEach((offer, index) => {
        if (offer.kind !== "item" || offer.qty === 0) return;
        // Stock comes from the loaded catalog, so every item has a price.
        out.push({
          shop,
          index,
          price: offerPrice(this.shopCtx, shop, offer, this.level(shop))!,
          rarity: offer.item.rarity,
          item: offer.item,
        });
      });
    }
    return out;
  }

  /**
   * Best gear upgrade by score gained per gold within `budget`. Offers are
   * evaluated by equipping the item into a copy of the gear, so unaffordable
   * upgrades can be priced too (the counterfactual purchase metrics) without
   * touching gold or shop stock.
   */
  bestGearBuyUpTo(
    budget: number,
    minRarity = this.profile.minRarity,
  ): GearUpgrade | null {
    if (this.bagFull()) return null;
    const now = this.score(this.save.gear);
    const minRank = minRarity ? RARITY_IDS.indexOf(minRarity) : -1;
    let best: GearUpgrade | null = null;
    for (const offer of this.gearOffers()) {
      if (offer.price > budget) continue;
      if (minRank >= 0 && RARITY_IDS.indexOf(offer.rarity) < minRank) continue;
      const added = addItem(this.save.gear, offer.item);
      const gain = this.bestEquip(added.gear, added.uid).score - now;
      if (gain <= 1e-9) continue;
      const gainPerGold = gain / offer.price;
      if (!best || gainPerGold > best.gainPerGold) {
        best = { ...offer, gain, gainPerGold };
      }
    }
    return best;
  }

  bestGearBuy(): GearUpgrade | null {
    return this.bestGearBuyUpTo(this.save.gold);
  }

  buyGear(o: GearOffer): void {
    const r = buyOffer(this.save, this.shopCtx, o.shop, o.index);
    /* v8 ignore next -- offers are pre-filtered by gold and bag space */
    if (!r.ok) return;
    const uid = r.save.gear.nextUid - 1;
    this.origin.set(uid, o.shop);
    this.save = { ...r.save, gear: this.bestEquip(r.save.gear, uid).gear };
    this.spent.gear += o.price;
    if (this.opts.sellSurplus) this.sellBag();
  }

  buyGearLoop(): void {
    for (let guard = 0; guard < 30; guard++) {
      const best = this.bestGearBuy();
      if (!best) return;
      this.buyGear(best);
    }
  }

  buyWallsLoop(): void {
    while (this.buyWall()) {
      // keep buying while affordable
    }
  }

  balancedLoop(): void {
    for (let guard = 0; guard < 40; guard++) {
      const gear = this.bestGearBuy();
      const wall = this.wallGainPerGold();
      if (!gear && wall <= 1e-9) return;
      if (gear && gear.gainPerGold >= wall) this.buyGear(gear);
      else this.buyWall();
    }
  }

  /**
   * Best upgrade the town offers within `budget`: the gear offer or wall level
   * with the most score per gold. Used for the deficit / forgone metrics.
   */
  bestUpgrade(budget: number): UpgradeOption | null {
    const gear = this.bestGearBuyUpTo(budget);
    const wall = this.wallOption();
    const wallOk = wall && wall.cost <= budget ? wall : null;
    if (gear && (!wallOk || gear.gainPerGold >= wallOk.gain / wallOk.cost)) {
      return { kind: "gear", cost: gear.price, gain: gear.gain };
    }
    return wallOk;
  }

  /** Buy potions and bombs (cheapest first) until stacks are full or gold runs out. */
  fillConsumables(): void {
    for (let guard = 0; guard < 60; guard++) {
      let pick: { shop: ShopId; index: number; price: number } | null = null;
      for (const shop of ["blacksmith", "trader"] as const) {
        shopOffers(this.save, this.shopCtx, shop).forEach((offer, index) => {
          if (offer.kind !== "consumable" || offer.qty === 0) return;
          const def = this.data.consumables.items[offer.id];
          if (!def || consumableCount(this.save, offer.id) >= def.maxStack) {
            return;
          }
          const price = offerPrice(this.shopCtx, shop, offer, this.level(shop));
          if (price === null || price > this.save.gold) return;
          if (!pick || price < pick.price) pick = { shop, index, price };
        });
      }
      if (!pick) return;
      const p: { shop: ShopId; index: number; price: number } = pick;
      const r = buyOffer(this.save, this.shopCtx, p.shop, p.index);
      /* v8 ignore next -- offers are pre-filtered by gold and stack */
      if (!r.ok) return;
      this.save = r.save;
      this.spent.consumables += p.price;
    }
  }

  /** Cheapest affordable next shop level, or null. */
  nextShopUpgrade(only?: ShopId): { shop: ShopId; cost: number } | null {
    let best: { shop: ShopId; cost: number } | null = null;
    for (const shop of SHOP_IDS) {
      if (only && shop !== only) continue;
      const def = this.data.buildings[shop];
      if (!def) continue;
      const level = this.save.buildings[shop] ?? 0;
      const cap = Math.min(def.maxLevel, this.data.shops[shop].levels.length);
      const cost = def.costByLevel[level];
      if (level >= cap || cost === undefined || cost > this.save.gold) continue;
      if (!best || cost < best.cost) best = { shop, cost };
    }
    return best;
  }

  /** Buy one shop level through the game's upgrade code; stock refreshes. */
  buyShopUpgrade(only?: ShopId): boolean {
    const next = this.nextShopUpgrade(only);
    if (!next) return false;
    const r = upgradeShop(this.data.buildings, this.save, next.shop);
    /* v8 ignore next -- nextShopUpgrade already checked level, cost and gold */
    if (r.result.kind !== "upgraded") return false;
    this.save = ensureShopStock(r.save, this.shopCtx, this.streams.shops);
    this.spent.shops += next.cost;
    return true;
  }

  buyShopsLoop(only?: ShopId): void {
    while (this.buyShopUpgrade(only)) {
      // keep upgrading while affordable
    }
  }

  /** Reroll trader stock (if worth it) and shop again, up to the daily cap. */
  rerollLoop(): void {
    while (this.rerolls < MAX_REROLLS_PER_DAY) {
      const cost = traderAt(this.shopCtx, this.level("trader")).rerollCost;
      if (cost <= 0 || this.save.gold < cost * 2) return;
      const r = rerollTrader(this.save, this.shopCtx, this.streams.rerolls);
      /* v8 ignore next -- cost and gold checked above */
      if (!r.ok) return;
      this.save = r.save;
      this.spent.rerolls += cost;
      this.rerolls += 1;
      this.balancedLoop();
    }
  }

  /**
   * Buy cheap shop items that match an outstanding buy request and sell them
   * to it: the trader pays `payoutPct` of value, so a discount offer profits.
   */
  flipRequests(): void {
    for (let guard = 0; guard < 20; guard++) {
      const best = this.bestRequestFlip();
      if (!best) return;
      this.buyGear(best.offer);
      const before = this.requestGold;
      this.fillRequests();
      if (this.opts.sellSurplus) this.sellBag();
      if (this.requestGold === before) return;
    }
  }

  /** Most profitable affordable shop item that matches an open buy request. */
  private bestRequestFlip(): { offer: GearOffer; profit: number } | null {
    const requests = this.save.shops.requests ?? [];
    if (!requests.length) return null;
    const config = this.data.shops.trader.requests;
    let best: { offer: GearOffer; profit: number } | null = null;
    for (const offer of this.gearOffers()) {
      if (offer.price > this.save.gold) continue;
      const resolved = resolveItem(this.data.catalog, {
        ...offer.item,
        uid: 0,
      });
      if (!resolved) continue;
      if (!requests.some((r) => requestMatches(r, resolved))) continue;
      const profit = requestPayout(resolved, config) - offer.price;
      if (profit > 0 && (!best || profit > best.profit)) {
        best = { offer, profit };
      }
    }
    return best;
  }

  private runPlan(): void {
    switch (this.profile.plan) {
      case "walls-first":
        this.buyWallsLoop();
        this.buyGearLoop();
        return;
      case "gear-first":
        this.buyGearLoop();
        this.buyWallsLoop();
        return;
      case "balanced":
        this.balancedLoop();
        return;
      case "potions":
        this.fillConsumables();
        this.balancedLoop();
        return;
      case "none":
        return;
      case "investor":
        this.buyShopsLoop();
        this.balancedLoop();
        return;
      case "reroller":
        this.buyShopsLoop("trader");
        this.balancedLoop();
        this.rerollLoop();
        return;
      case "hybrid":
        while (
          wallLevel(this.save) < HYBRID_WALL_LEVELS &&
          this.wallCost() !== null
        ) {
          if (!this.buyWall()) break;
        }
        this.balancedLoop();
        this.buyShopsLoop();
        this.rerollLoop();
        return;
    }
  }

  spend(): void {
    this.runPlan();
    if (this.profile.flipRequests) this.flipRequests();
    if (!this.profile.spareToShops) return;
    if (this.buyShopUpgrade()) {
      this.buyShopsLoop();
      // New stock at the new level: shop again with what is left.
      this.runPlan();
    }
  }

  /** Use every carried potion and bomb (they are spent). */
  useConsumables(): { boost: ConsumableBoost; used: number } {
    const boost: ConsumableBoost = { healHp: 0, bombDamage: 0 };
    let used = 0;
    for (const [id, count] of Object.entries(this.save.consumables)) {
      // Only consumables from the loaded config can be bought.
      const def = this.data.consumables.items[id]!;
      used += count;
      if (def.kind === "heal") boost.healHp += def.healHp! * count;
      else boost.bombDamage += def.bomb!.damage * count;
    }
    this.save = { ...this.save, consumables: {} };
    return { boost, used };
  }
}

function emptySpend() {
  return { wall: 0, gear: 0, consumables: 0, shops: 0, rerolls: 0 };
}

function rarityOf(drafts: readonly { rarity: RarityId }[]): RarityCounts {
  const out = emptyRarityCounts();
  for (const d of drafts) out[d.rarity] += 1;
  return out;
}

function wallLevel(save: SaveGame): number {
  /* v8 ignore next -- createNewSave always sets buildings.wall */
  return save.buildings.wall ?? 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

type NightFight = {
  night: number;
  won: boolean;
  pressure: NightPressure;
  power: PlayerPower;
  consumablesUsed: number;
  outcome: NightOutcome | null;
  drops: ItemDraft[];
  added: ReturnType<typeof resolveCampaignNightEnd>;
};

/** Play the night `run` is about to face, including drops and the night end. */
function fightNight(run: Run, seed: number, attempt: number): NightFight {
  const { data, opts } = run;
  run.save = prepareDefenseNight(run.save);
  const night = run.save.night;
  const difficulty = run.difficulty();
  run.streams = nightStreams(seed, night, attempt);
  const streams = run.streams;
  const power = run.power();
  let pressure = nightPressure(
    power,
    difficulty,
    run.save.townWallHpMax,
    opts.model,
  );
  opts.onNightStart?.(run.save, pressure);
  let consumablesUsed = 0;
  let boost: ConsumableBoost = { healHp: 0, bombDamage: 0 };
  if (
    pressure.winChance < opts.consumableUseBelow &&
    Object.keys(run.save.consumables).length > 0
  ) {
    const used = run.useConsumables();
    consumablesUsed = used.used;
    boost = used.boost;
    pressure = nightPressure(
      power,
      difficulty,
      run.save.townWallHpMax,
      opts.model,
      boost,
    );
  }
  // The power model resolves the night spawn group by spawn group; the fixed
  // model keeps one roll per night so economy runs stay pure.
  const outcome =
    opts.winModel === "fixed"
      ? null
      : resolveNightStages(
          power,
          difficulty,
          run.save.townWallHpMax,
          opts.model,
          boost,
          streams.win,
          pressure,
        );
  const won = outcome ? outcome.won : streams.win() < opts.winRate;
  const drops: ItemDraft[] = rollNightDrops(
    data.catalog,
    won,
    night,
    streams.drops,
    data.loot,
  );
  // Same night-end path as DefenseNightEnd: gold, wall, night advance, drops
  // into the bag (overflow auto-sold).
  const uidBefore = run.save.gear.nextUid;
  const added = resolveCampaignNightEnd({
    won,
    // A loss means the wall fell (rebuilt to full by prepareDefenseNight).
    wallHp: won ? run.save.townWallHp : 0,
    wallHpStart: run.save.townWallHp,
    rewardGold: difficulty.rewardGold,
    save: run.save,
    drops,
    catalog: data.catalog,
    loot: data.loot,
  });
  run.save = added.save;
  for (let uid = uidBefore; uid < run.save.gear.nextUid; uid++) {
    run.origin.set(uid, "drop");
  }
  run.spent = emptySpend();
  run.rerolls = 0;
  run.salesGold = added.soldGold;
  run.requestGold = 0;
  run.requestsFilled = 0;
  return {
    night,
    won,
    pressure,
    power,
    consumablesUsed,
    outcome,
    drops,
    added,
  };
}

type TownStats = {
  requestsPosted: number;
  goldInTown: number;
  offers: GearOffer[];
  shopMedianPrice: number;
  traderMedianPrice: number;
  purchasingPower: number;
  deficit: boolean;
  deficitGold: number;
  forgoneScore: number;
};

/** Shop, equip and spend for one town visit; records the economy signals. */
function townPhase(run: Run): TownStats {
  const { opts } = run;
  run.allocateTalents();
  run.save = ensureShopStock(run.save, run.shopCtx, run.streams.shops);
  const requestsPosted = run.save.shops.requests?.length ?? 0;
  const goldInTown = run.save.gold;
  const offers = run.gearOffers();
  const shopMedianPrice = median(offers.map((o) => o.price));
  // Can this income buy the next upgrade at all, and what was left on the
  // table if not? Measured on entering town, before any selling.
  const wanted = run.bestUpgrade(goldInTown > 0 ? goldInTown * 2 : Infinity);
  const deficit = !!wanted && wanted.cost > goldInTown;
  run.equipUpgrades();
  if (opts.sellSurplus) run.sellBag();
  run.spend();
  run.equipUpgrades();
  if (opts.sellSurplus) run.sellBag();
  return {
    requestsPosted,
    goldInTown,
    offers,
    shopMedianPrice,
    traderMedianPrice: median(
      offers.filter((o) => o.shop === "trader").map((o) => o.price),
    ),
    purchasingPower: shopMedianPrice > 0 ? goldInTown / shopMedianPrice : 0,
    deficit,
    deficitGold: deficit ? wanted!.cost - goldInTown : 0,
    forgoneScore: deficit ? wanted!.gain : 0,
  };
}

type StageStats = Pick<
  NightRecord,
  "stages" | "stageWon" | "failedStage" | "failedOn" | "hpLeft" | "wallLeft"
>;

function stageStats(outcome: NightOutcome | null, won: boolean): StageStats {
  if (!outcome) {
    return {
      stages: 1,
      stageWon: won ? 1 : 0,
      failedStage: won ? null : 0,
      failedOn: null,
      hpLeft: 1,
      wallLeft: 1,
    };
  }
  return {
    stages: outcome.stages.length,
    stageWon: outcome.stages.filter((s) => s.won).length,
    failedStage: outcome.failedStage,
    failedOn: outcome.failedOn,
    hpLeft: outcome.hpLeft,
    wallLeft: outcome.wallLeft,
  };
}

function equippedItems(
  run: Run,
): Array<{ uid: number; itemLevel: number; rarity: RarityId }> {
  return EQUIP_SLOTS.map((s: EquipSlot) => run.save.gear.equipped[s])
    .filter((uid): uid is number => uid !== undefined)
    .map((uid) => run.save.gear.items.find((i) => i.uid === uid))
    .filter((i) => i !== undefined);
}

const mean = (xs: readonly number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** One night's record, assembled from the fight and the town phase. */
function nightRecord(
  run: Run,
  fight: NightFight,
  town: TownStats,
  attempt: number,
): NightRecord {
  const equipped = equippedItems(run);
  const from = (test: (origin: "drop" | ShopId | undefined) => boolean) =>
    equipped.filter((i) => test(run.origin.get(i.uid))).length;
  return {
    night: fight.night,
    attempt,
    won: fight.won,
    pressure: fight.pressure,
    power: fight.power,
    consumablesUsed: fight.consumablesUsed,
    goldEarned: fight.added.result.goldEarned,
    salesGold: run.salesGold,
    spentWall: run.spent.wall,
    spentGear: run.spent.gear,
    spentConsumables: run.spent.consumables,
    spentShops: run.spent.shops,
    spentRerolls: run.spent.rerolls,
    rerolls: run.rerolls,
    requestGold: run.requestGold,
    requestsFilled: run.requestsFilled,
    requestsPosted: town.requestsPosted,
    traderLevel: run.level("trader"),
    blacksmithLevel: run.level("blacksmith"),
    goldBanked: run.save.gold,
    wallLevel: wallLevel(run.save),
    wallHpMax: run.save.townWallHpMax,
    drops: fight.drops.length,
    dropRarity: rarityOf(fight.drops),
    autoSold: fight.added.soldCount,
    bagCount: bagItems(run.save.gear).length,
    bagCapacity: run.data.loot.inventoryCapacity,
    shopItems: town.offers.length,
    shopAffordable: town.offers.filter((o) => o.price <= town.goldInTown)
      .length,
    shopMedianPrice: town.shopMedianPrice,
    purchasingPower: town.purchasingPower,
    deficit: town.deficit,
    deficitGold: town.deficitGold,
    forgoneScore: town.forgoneScore,
    traderMedianPrice: town.traderMedianPrice,
    equippedCount: equipped.length,
    avgItemLevel: mean(equipped.map((i) => i.itemLevel)),
    equippedRarity: rarityOf(equipped),
    equippedFromDrops: from((o) => o === "drop"),
    equippedFromShop: from((o) => o === "trader" || o === "blacksmith"),
    equippedFromTrader: from((o) => o === "trader"),
    powerAfter: run.power(),
    ...stageStats(fight.outcome, fight.won),
  };
}

/** Simulate one campaign from a fresh save. */
export function simulateRun(
  data: SimData,
  opts: SimOptions,
  seed: number,
): RunResult {
  const run = new Run(data, opts);
  run.allocateTalents();
  const records: NightRecord[] = [];
  let finished = false;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const fight = fightNight(run, seed, attempt);
    const town = townPhase(run);
    records.push(nightRecord(run, fight, town, attempt));
    if (fight.won && fight.night >= opts.nights) {
      finished = true;
      break;
    }
  }
  return { seed, finished, records, talents: run.save.talents };
}

/** Run `runs` campaigns with seeds `seed, seed+1, …`. */
export function simulateMany(
  data: SimData,
  opts: SimOptions,
  seed: number,
  runs: number,
): RunResult[] {
  const out: RunResult[] = [];
  for (let i = 0; i < runs; i++) out.push(simulateRun(data, opts, seed + i));
  return out;
}
