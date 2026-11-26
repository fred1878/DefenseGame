/**
 * Blacksmith / Trader panel view model: header, tabs, filter chips, card
 * grid, "Coming soon" cards, detail + compare and the bottom action bar.
 */
import type { SaveGame } from "../../core/saveTypes";
import { consumableEffectLine } from "../../gear/consumables";
import { goldAfterRow, type CompareRow } from "../../gear/gearCompare";
import { bagItems } from "../../gear/inventory";
import { createBaseItem } from "../../gear/itemGen";
import { resolveItem } from "../../gear/itemStats";
import {
  blacksmithAt,
  nextBlacksmithUnlock,
  offerPrice,
  shopLevel,
  shopTitle,
  type ShopOffer,
} from "../../gear/shops";
import { iconForConsumable, type UiIconName } from "../icons/uiIcons";
import { DG_THEME } from "../theme/dgTheme";
import {
  entryMatches,
  GEAR_FILTERS,
  listEntries,
  bagEntries,
  shopEntries,
  type GearFilter,
  type GearPanelContext,
  type GearPanelState,
  type PanelEntry,
} from "./gearPanelLogic";
import {
  CONSUMABLE_COLOR,
  consumableLines,
  consumableSubline,
  consumableTile,
  consumableTypeLabel,
  draftItemCompare,
  itemDetailLines,
  itemKeyStat,
  itemSubline,
  itemTile,
  itemTypeShort,
  ownedItemCompare,
  type DetailLine,
  type TileView,
} from "./gearPanelView";
import { shopUpgradeInfo } from "./shopPanelLogic";

export type ShopCardView = {
  key: number;
  tile: TileView;
  name: string;
  nameColor: string;
  meta: string;
  metaColor: string;
  stat: string;
  price: string;
  priceColor: string;
  selected: boolean;
  locked: boolean;
};

const FILTER_LABELS: Record<GearFilter, string> = {
  all: "All",
  weapons: "Weapons",
  armour: "Armour",
  jewellery: "Jewellery",
  consumables: "Consumables",
};

export type ChipView = { id: GearFilter; label: string; active: boolean };

function tabEntries(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): PanelEntry[] {
  return state.tab === "shop" ? shopEntries(ctx, save) : bagEntries(ctx, save);
}

/** Chips for the active tab: "All" plus every category that has something. */
export function filterChips(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): ChipView[] {
  const all = tabEntries(ctx, save, state);
  return GEAR_FILTERS.filter(
    (f) =>
      f === "all" || f === state.filter || all.some((e) => entryMatches(e, f)),
  ).map((id) => ({
    id,
    label: FILTER_LABELS[id],
    active: id === state.filter,
  }));
}

export type ShopHeaderView = {
  title: string;
  subtitle: string;
  gold: string;
  buyCount: string;
  sellCount: string;
};

export function shopHeader(
  ctx: GearPanelContext,
  save: SaveGame,
): ShopHeaderView {
  const shop = ctx.shop!;
  const info = shopUpgradeInfo(ctx, save);
  const parts = [`Night ${save.night}`];
  if (info) parts.push(`Level ${info.level}/${info.maxLevel}`);
  if (shop.id === "trader") parts.push("New stock every night");
  return {
    title: shopTitle(shop.ctx, shop.id),
    subtitle: parts.join(" · "),
    gold: `${save.gold}g`,
    buyCount: String(shopEntries(ctx, save).length),
    sellCount: `${bagItems(save.gear).length} in bag`,
  };
}

function entryCard(
  entry: PanelEntry,
  gold: number,
  selected: boolean,
  selling: boolean,
): ShopCardView {
  const price = entry.price;
  const soldOut = entry.qty === 0;
  const unaffordable = !selling && price !== null && price > gold;
  const priceText = price === null ? "—" : soldOut ? "Sold out" : `${price}g`;
  const priceColor =
    price === null || soldOut
      ? DG_THEME.textMuted
      : unaffordable
        ? DG_THEME.stateNegative
        : DG_THEME.accentGoldBright;
  const left =
    entry.qty !== null && entry.qty > 0 ? ` · ${entry.qty} left` : "";
  if (entry.kind === "consumable") {
    return {
      key: entry.key,
      tile: consumableTile(entry.def, entry.count),
      name: entry.def.name,
      nameColor: CONSUMABLE_COLOR,
      meta: `${consumableTypeLabel(entry.def)} · ${entry.count} owned${left}`,
      metaColor: DG_THEME.textMuted,
      stat: consumableEffectLine(entry.def),
      price: priceText,
      priceColor,
      selected,
      locked: false,
    };
  }
  const r = entry.item;
  return {
    key: entry.key,
    tile: itemTile(r),
    name: r.name,
    nameColor: r.rarity.color,
    meta: `${itemTypeShort(r.base.type)} · ilvl ${r.item.itemLevel}${left}`,
    metaColor: DG_THEME.textMuted,
    stat: itemKeyStat(r),
    price: priceText,
    priceColor,
    selected,
    locked: false,
  };
}

/** Cards for the active tab (all pages; the panel slices). */
export function shopCards(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): ShopCardView[] {
  const selling = state.tab === "bag";
  const selectedKey = selling ? state.selectedUid : state.selectedOffer;
  return listEntries(ctx, save, state).map((e) =>
    entryCard(e, save.gold, e.key === selectedKey, selling),
  );
}

/**
 * Blacksmith rows not unlocked yet (Buy tab, matching the filter): the next
 * `max` by unlock night, shown greyed with "Unlocks night N".
 */
export function lockedCards(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
  max = 2,
): ShopCardView[] {
  const shop = ctx.shop;
  if (shop?.id !== "blacksmith" || state.tab !== "shop") return [];
  const level = shopLevel(save, shop.ctx, "blacksmith");
  const b = blacksmithAt(shop.ctx, level);
  const unlockedBy = save.night + b.unlockNightsEarly;
  const rows: { night: number; offer: ShopOffer }[] = [];
  for (const row of b.items) {
    if (row.unlockNight <= unlockedBy || !ctx.catalog.bases[row.baseId]) {
      continue;
    }
    const item = createBaseItem(ctx.catalog, row.baseId, 1);
    rows.push({
      night: row.unlockNight,
      offer: { kind: "item", item, qty: null },
    });
  }
  for (const row of b.consumables) {
    if (row.unlockNight <= unlockedBy || !shop.ctx.consumables.items[row.id]) {
      continue;
    }
    rows.push({
      night: row.unlockNight,
      offer: { kind: "consumable", id: row.id, qty: null },
    });
  }
  const out: ShopCardView[] = [];
  rows
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => a.night - b.night || a.i - b.i)
    .forEach(({ night, offer }, key) => {
      const price = offerPrice(shop.ctx, "blacksmith", offer, level);
      const shownNight = Math.max(1, night - b.unlockNightsEarly);
      const base = {
        key,
        selected: false,
        locked: true,
        meta: `Unlocks night ${shownNight}`,
        metaColor: DG_THEME.accentGold,
        price: price === null ? "—" : `${price}g`,
        priceColor: DG_THEME.textMuted,
      };
      if (offer.kind === "consumable") {
        const def = shop.ctx.consumables.items[offer.id]!;
        const entry: PanelEntry = {
          kind: "consumable",
          key,
          def,
          price,
          qty: null,
          count: 0,
        };
        if (!entryMatches(entry, state.filter)) return;
        out.push({
          ...base,
          tile: {
            icon: iconForConsumable(def),
            color: DG_THEME.borderIron,
            badge: "",
          },
          name: def.name,
          nameColor: DG_THEME.textMuted,
          stat: consumableEffectLine(def),
        });
        return;
      }
      const r = resolveItem(ctx.catalog, { ...offer.item, uid: 0 })!;
      const entry: PanelEntry = {
        kind: "item",
        key,
        item: r,
        price,
        qty: null,
      };
      if (!entryMatches(entry, state.filter)) return;
      out.push({
        ...base,
        tile: { ...itemTile(r), color: DG_THEME.borderIron },
        name: r.name,
        nameColor: DG_THEME.textMuted,
        stat: itemKeyStat(r),
      });
    });
  return out.slice(0, max);
}

export type SectionView = { left: string; right: string };

/** Grid section heading ("Forge stock · 12 items") and the "Coming soon" heading. */
export function shopSections(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
  count: number,
): { stock: SectionView; soon: SectionView } {
  const shop = ctx.shop!;
  const items = `${count} ${count === 1 ? "item" : "items"}`;
  if (state.tab === "bag") {
    return {
      stock: {
        left: "Your bag",
        right: `${items} · sell for ${ctx.loot.sellBackPct}%`,
      },
      soon: { left: "", right: "" },
    };
  }
  const level = shopLevel(save, shop.ctx, shop.id);
  const next =
    shop.id === "blacksmith"
      ? nextBlacksmithUnlock(shop.ctx, save.night, level)
      : null;
  return {
    stock: {
      left: shop.id === "blacksmith" ? "Forge stock" : "Today's stock",
      right: items,
    },
    soon: {
      left: "Coming soon",
      right: next === null ? "" : `More stock at night ${next}`,
    },
  };
}

export type DetailView = {
  tile: TileView | null;
  name: string;
  nameColor: string;
  subline: string;
  /** Stat lines (affixes / effects). */
  lines: DetailLine[];
  compareTitle: string;
  against: string;
  againstColor: string;
  rows: CompareRow[];
  /** Plain text lines (idle shop info). */
  info: string[];
};

export const emptyDetail = (): DetailView => ({
  tile: null,
  name: "",
  nameColor: DG_THEME.textPrimary,
  subline: "",
  lines: [],
  compareTitle: "",
  against: "",
  againstColor: DG_THEME.textMuted,
  rows: [],
  info: [],
});

function idleDetail(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): DetailView {
  const shop = ctx.shop!;
  const d = emptyDetail();
  const info = shopUpgradeInfo(ctx, save);
  d.name = shopTitle(shop.ctx, shop.id);
  d.subline =
    state.tab === "shop"
      ? "Tap a card to see its stats and compare."
      : "Tap an item in your bag to sell it.";
  if (info) {
    d.name = `${d.name} · Level ${info.level}/${info.maxLevel}`;
    d.info.push(`Now: ${info.current}`);
    d.info.push(
      info.next
        ? `Next (${info.nextCost ?? "?"}g): ${info.next}`
        : "Fully upgraded.",
    );
  }
  if (shop.id === "trader") {
    d.info.push("Stock changes after every night.");
  } else {
    const next = nextBlacksmithUnlock(
      shop.ctx,
      save.night,
      shopLevel(save, shop.ctx, "blacksmith"),
    );
    d.info.push(
      next === null
        ? "Full catalogue unlocked."
        : `More stock unlocks at night ${next}.`,
    );
  }
  return d;
}

/** Detail + compare for the selected card, or shop info when nothing is selected. */
export function shopDetail(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): DetailView {
  const selling = state.tab === "bag";
  const key = selling ? state.selectedUid : state.selectedOffer;
  const entry =
    key === null
      ? undefined
      : tabEntries(ctx, save, state).find((e) => e.key === key);
  if (!entry) return idleDetail(ctx, save, state);
  const d = emptyDetail();
  if (entry.kind === "consumable") {
    d.tile = consumableTile(entry.def, entry.count);
    d.name = entry.def.name;
    d.nameColor = CONSUMABLE_COLOR;
    d.subline = consumableSubline(entry.def);
    d.lines = consumableLines(save, entry.def);
    d.compareTitle = "Purchase";
    if (entry.price !== null) {
      d.rows = [goldAfterRow("Gold after purchase", save.gold, -entry.price)];
    }
    return d;
  }
  const r = entry.item;
  d.tile = itemTile(r);
  d.name = r.name;
  d.nameColor = r.rarity.color;
  d.subline = itemSubline(r);
  d.lines = itemDetailLines(ctx.catalog, r);
  const cmp = selling
    ? ownedItemCompare(ctx.catalog, save.gear, entry.key)
    : draftItemCompare(ctx.catalog, save.gear, r);
  d.compareTitle = cmp.title;
  d.against = cmp.against;
  d.againstColor = cmp.againstColor;
  d.rows = [...cmp.rows];
  if (entry.price !== null) {
    d.rows.push(
      selling
        ? goldAfterRow("Gold after sale", save.gold, entry.price)
        : goldAfterRow("Gold after purchase", save.gold, -entry.price),
    );
  }
  return d;
}

export type ActionStyle = "buy" | "equip" | "sell" | "neutral";

export type ActionView = {
  id:
    | "buy"
    | "buyEquip"
    | "sell"
    | "equip"
    | "unequip"
    | "upgrade"
    | "reroll"
    | "fill";
  label: string;
  icon: UiIconName;
  style: ActionStyle;
  enabled: boolean;
};

/** Bottom action bar for the shop panel (1–2 buttons). */
export function shopActions(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): ActionView[] {
  if (state.tab === "bag") {
    const entry =
      state.selectedUid === null
        ? undefined
        : bagEntries(ctx, save).find((e) => e.key === state.selectedUid);
    return [
      {
        id: "sell",
        label: entry?.price != null ? `Sell · ${entry.price}g` : "Sell",
        icon: "coins",
        style: "sell",
        enabled: !!entry,
      },
      {
        id: "equip",
        label: "Equip",
        icon: "arrowUp",
        style: "equip",
        enabled: !!entry,
      },
    ];
  }
  const entry =
    state.selectedOffer === null
      ? undefined
      : shopEntries(ctx, save).find((e) => e.key === state.selectedOffer);
  if (!entry) {
    const info = shopUpgradeInfo(ctx, save);
    const out: ActionView[] = [];
    if (info) {
      out.push({
        id: "upgrade",
        label:
          info.nextCost !== null ? `Upgrade · ${info.nextCost}g` : "Max level",
        icon: "arrowUp",
        style: "buy",
        enabled: info.nextCost !== null,
      });
    }
    if (info && info.rerollCost > 0) {
      out.push({
        id: "reroll",
        label: `Reroll · ${info.rerollCost}g`,
        icon: "refresh",
        style: "neutral",
        enabled: true,
      });
    }
    return out;
  }
  const affordable =
    entry.price !== null && entry.price <= save.gold && entry.qty !== 0;
  const bagRoom = bagItems(save.gear).length < ctx.loot.inventoryCapacity;
  return [
    {
      id: "buy",
      label: entry.price !== null ? `Buy · ${entry.price}g` : "Buy",
      icon: "coins",
      style: "buy",
      enabled: affordable,
    },
    {
      id: "buyEquip",
      label: "Buy & Equip",
      icon: "arrowUp",
      style: "equip",
      enabled: affordable && entry.kind === "item" && bagRoom,
    },
  ];
}

/** Line under the action bar: the last status message, else a hint. */
export function shopFootnote(
  ctx: GearPanelContext,
  state: GearPanelState,
): { text: string; color: string } {
  if (state.status)
    return { text: state.status, color: DG_THEME.accentGoldBright };
  const pct = ctx.loot.sellBackPct;
  if (state.tab === "requests" && ctx.shop) {
    const pays = ctx.shop.ctx.shops.trader.requests.payoutPct;
    return {
      text: `Requests pay ${pays}% (normal selling pays ${pct}%).`,
      color: DG_THEME.textMuted,
    };
  }
  return {
    text:
      state.tab === "shop"
        ? `Bought gear goes to your bag. Sell back for ${pct}%.`
        : `Items sell for ${pct}% of their value.`,
    color: DG_THEME.textMuted,
  };
}
