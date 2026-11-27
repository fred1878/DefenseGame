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
import { bagItems, equipItem, removeItem } from "../../gear/inventory";
import { equipSlotsForType, type ItemDraft } from "../../gear/itemGen";
import { resolveItem, sellValue } from "../../gear/itemStats";
import { rollNightDrops } from "../../gear/loot";
import { resolveCampaignNightEnd } from "../../gear/nightLootSummary";
import { createRng, type Rng } from "../../gear/rng";
import { requestMatchesInBag } from "../../gear/buyRequests";
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
};

type SpendPlan =
  | "walls-first"
  | "gear-first"
  | "balanced"
  | "potions"
  | "none"
  | "investor"
  | "reroller";

type Profile = {
  plan: SpendPlan;
  /** Gear focus metric; gear score = power ratio × (metric / metric with no gear). */
  focus?: (p: PlayerPower) => number;
  /** Put gold left after the plan into shop upgrades. */
  spareToShops: boolean;
  /**
   * Talent branch ids to fill in order (best-scoring learnable node inside the
   * first branch with one); unset = best-scoring node anywhere in the tree.
   */
  talentBranches?: string[];
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
};

/** Trader rerolls a reroller makes per town visit at most. */
const MAX_REROLLS_PER_DAY = 3;

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

/** Mutable state of one simulated campaign. */
class Run {
  save: SaveGame;
  readonly origin = new Map<number, "drop" | ShopId>();
  readonly shopCtx: ShopContext;
  private readonly store: DataStore;
  readonly profile: Profile;
  private readonly focusBase: number;
  spent = emptySpend();
  rerolls = 0;
  salesGold = 0;
  requestGold = 0;
  requestsFilled = 0;

  constructor(
    readonly data: SimData,
    readonly opts: SimOptions,
    readonly rng: Rng,
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
    const empty = { items: [], equipped: {}, nextUid: 1 };
    this.focusBase = this.profile.focus?.(this.power(empty)) ?? 1;
  }

  difficulty(): NightDifficulty {
    const nights = this.data.nights;
    const idx = Math.min(this.save.night, nights.length) - 1;
    return nights[Math.max(0, idx)]!;
  }

  power(
    gear: SaveGear = this.save.gear,
    talents: SaveTalents = this.save.talents,
  ): PlayerPower {
    return playerPower(
      this.data.catalog,
      gear,
      this.opts.model,
      talentBonus(this.data.talents, talents),
    );
  }

  /** Gear / wall choice score: power ratio, tilted toward the profile's focus stat. */
  score(
    gear: SaveGear,
    wallHpMax = this.save.townWallHpMax,
    talents: SaveTalents = this.save.talents,
  ): number {
    const power = this.power(gear, talents);
    const ratio = nightPressure(
      power,
      this.difficulty(),
      wallHpMax,
      this.opts.model,
    ).powerRatio;
    const focus = this.profile.focus;
    if (!focus) return ratio;
    return ratio * (Math.max(0, focus(power)) / this.focusBase);
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

  wallGainPerGold(): number {
    const cost = this.wallCost();
    if (cost === null || cost > this.save.gold) return 0;
    const r = handleTownBuildingTap(this.store, this.save, WALL_BUILDING);
    /* v8 ignore next -- wallCost already checked level, cost and gold */
    if (r.result.kind !== "upgraded") return 0;
    const now = this.score(this.save.gear);
    return (this.score(this.save.gear, r.save.townWallHpMax) - now) / cost;
  }

  gearOffers(): { shop: ShopId; index: number; price: number }[] {
    const out: { shop: ShopId; index: number; price: number }[] = [];
    for (const shop of ["trader", "blacksmith"] as const) {
      shopOffers(this.save, this.shopCtx, shop).forEach((offer, index) => {
        if (offer.kind !== "item" || offer.qty === 0) return;
        // Stock comes from the loaded catalog, so every item has a price.
        out.push({
          shop,
          index,
          price: offerPrice(this.shopCtx, shop, offer, this.level(shop))!,
        });
      });
    }
    return out;
  }

  /** Best affordable gear upgrade by score gained per gold, or null. */
  bestGearBuy(): {
    shop: ShopId;
    index: number;
    price: number;
    gainPerGold: number;
  } | null {
    const now = this.score(this.save.gear);
    let best: ReturnType<Run["bestGearBuy"]> = null;
    for (const o of this.gearOffers()) {
      if (o.price > this.save.gold) continue;
      const r = buyOffer(this.save, this.shopCtx, o.shop, o.index);
      if (!r.ok) continue;
      const uid = r.save.gear.nextUid - 1;
      const gain = (this.bestEquip(r.save.gear, uid).score - now) / o.price;
      if (gain > 1e-9 && (!best || gain > best.gainPerGold)) {
        best = { ...o, gainPerGold: gain };
      }
    }
    return best;
  }

  buyGear(o: { shop: ShopId; index: number; price: number }): void {
    const r = buyOffer(this.save, this.shopCtx, o.shop, o.index);
    /* v8 ignore next -- bestGearBuy only returns offers that buy */
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
    this.save = ensureShopStock(r.save, this.shopCtx, this.rng);
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
      const r = rerollTrader(this.save, this.shopCtx, this.rng);
      /* v8 ignore next -- cost and gold checked above */
      if (!r.ok) return;
      this.save = r.save;
      this.spent.rerolls += cost;
      this.rerolls += 1;
      this.balancedLoop();
    }
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
    }
  }

  spend(): void {
    this.runPlan();
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

/** Simulate one campaign from a fresh save. */
export function simulateRun(
  data: SimData,
  opts: SimOptions,
  seed: number,
): RunResult {
  const rng = createRng(seed);
  const run = new Run(data, opts, rng);
  run.allocateTalents();
  const records: NightRecord[] = [];
  let finished = false;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    run.save = prepareDefenseNight(run.save);
    const night = run.save.night;
    const difficulty = run.difficulty();
    const power = run.power();
    let pressure = nightPressure(
      power,
      difficulty,
      run.save.townWallHpMax,
      opts.model,
    );
    opts.onNightStart?.(run.save, pressure);
    let consumablesUsed = 0;
    if (
      pressure.winChance < opts.consumableUseBelow &&
      Object.keys(run.save.consumables).length > 0
    ) {
      const u = run.useConsumables();
      consumablesUsed = u.used;
      pressure = nightPressure(
        power,
        difficulty,
        run.save.townWallHpMax,
        opts.model,
        u.boost,
      );
    }
    const chance =
      opts.winModel === "fixed" ? opts.winRate : pressure.winChance;
    const won = rng() < chance;
    const drops: ItemDraft[] = rollNightDrops(
      data.catalog,
      won,
      night,
      rng,
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
    const goldEarned = added.result.goldEarned;
    run.save = added.save;
    for (let uid = uidBefore; uid < run.save.gear.nextUid; uid++) {
      run.origin.set(uid, "drop");
    }
    run.spent = emptySpend();
    run.rerolls = 0;
    run.salesGold = added.soldGold;
    run.requestGold = 0;
    run.requestsFilled = 0;

    // Town phase.
    run.allocateTalents();
    run.save = ensureShopStock(run.save, run.shopCtx, rng);
    const requestsPosted = run.save.shops.requests?.length ?? 0;
    const goldInTown = run.save.gold;
    const offers = run.gearOffers();
    const traderPrices = offers
      .filter((o) => o.shop === "trader")
      .map((o) => o.price);
    run.equipUpgrades();
    if (opts.sellSurplus) run.sellBag();
    run.spend();
    run.equipUpgrades();
    if (opts.sellSurplus) run.sellBag();

    const equipped = EQUIP_SLOTS.map(
      (s: EquipSlot) => run.save.gear.equipped[s],
    )
      .filter((uid): uid is number => uid !== undefined)
      .map((uid) => run.save.gear.items.find((i) => i.uid === uid))
      .filter((i) => i !== undefined);
    records.push({
      night,
      attempt,
      won,
      pressure,
      power,
      consumablesUsed,
      goldEarned,
      salesGold: run.salesGold,
      spentWall: run.spent.wall,
      spentGear: run.spent.gear,
      spentConsumables: run.spent.consumables,
      spentShops: run.spent.shops,
      spentRerolls: run.spent.rerolls,
      rerolls: run.rerolls,
      requestGold: run.requestGold,
      requestsFilled: run.requestsFilled,
      requestsPosted,
      traderLevel: run.level("trader"),
      blacksmithLevel: run.level("blacksmith"),
      goldBanked: run.save.gold,
      wallLevel: wallLevel(run.save),
      wallHpMax: run.save.townWallHpMax,
      drops: drops.length,
      dropRarity: rarityOf(drops),
      autoSold: added.soldCount,
      bagCount: bagItems(run.save.gear).length,
      bagCapacity: data.loot.inventoryCapacity,
      shopItems: offers.length,
      shopAffordable: offers.filter((o) => o.price <= goldInTown).length,
      traderMedianPrice: median(traderPrices),
      equippedCount: equipped.length,
      avgItemLevel: equipped.length
        ? equipped.reduce((a, i) => a + i.itemLevel, 0) / equipped.length
        : 0,
      equippedRarity: rarityOf(equipped),
      equippedFromDrops: equipped.filter(
        (i) => run.origin.get(i.uid) === "drop",
      ).length,
      equippedFromShop: equipped.filter((i) => {
        const o = run.origin.get(i.uid);
        return o === "trader" || o === "blacksmith";
      }).length,
      equippedFromTrader: equipped.filter(
        (i) => run.origin.get(i.uid) === "trader",
      ).length,
      powerAfter: run.power(),
    });
    if (won && night >= opts.nights) {
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
