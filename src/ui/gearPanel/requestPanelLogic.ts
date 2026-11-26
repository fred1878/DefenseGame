import {
  describeRequest,
  requestMatchesInBag,
  requestPayout,
  type BuyRequest,
} from "../../gear/buyRequests";
import type { GearCatalog, ItemType } from "../../gear/gearTypes";
import type { SaveGame } from "../../core/saveTypes";
import { iconForItemType } from "../icons/uiIcons";
import { DG_THEME } from "../theme/dgTheme";
import type { GearPanelContext, GearPanelState } from "./gearPanelLogic";
import {
  emptyDetail,
  type ActionView,
  type DetailView,
  type ShopCardView,
} from "./shopPanelView";

/** The trader's buy requests for today (other shops post none). */
export function traderRequests(
  ctx: GearPanelContext,
  save: SaveGame,
): BuyRequest[] {
  return ctx.shop?.id === "trader" ? (save.shops.requests ?? []) : [];
}

function kindLabel(request: BuyRequest): string {
  if (request.kind === "base") return "Any rarity";
  if (request.kind === "unique") return "Unique";
  return "Any match";
}

function requestItemType(
  catalog: GearCatalog,
  request: BuyRequest,
): ItemType | null {
  if (request.kind === "type") return request.itemType;
  const baseId =
    request.kind === "base"
      ? request.baseId
      : catalog.uniques[request.uniqueId]?.baseId;
  return (baseId && catalog.bases[baseId]?.type) || null;
}

function payoutPct(ctx: GearPanelContext): number {
  return ctx.shop!.ctx.shops.trader.requests.payoutPct;
}

/** "Wants" tab cards: what the trader wants and the best bag match, if any. */
export function requestCards(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): ShopCardView[] {
  if (!ctx.shop) return [];
  const config = ctx.shop.ctx.shops.trader.requests;
  return traderRequests(ctx, save).map((request, key) => {
    const { name, color } = describeRequest(ctx.catalog, request);
    const best = requestMatchesInBag(save, ctx.catalog, request)[0];
    const type = requestItemType(ctx.catalog, request);
    return {
      key,
      tile: {
        icon: type ? iconForItemType(type) : "coins",
        color,
        badge: "",
      },
      name,
      nameColor: color,
      meta: `${kindLabel(request)} · pays ${config.payoutPct}%`,
      metaColor: DG_THEME.textMuted,
      stat: best ? `Your ${best.name}` : "No match in your bag",
      price: best ? `${requestPayout(best, config)}g` : "—",
      priceColor: best ? DG_THEME.accentGoldBright : DG_THEME.textMuted,
      selected: state.selectedOffer === key,
      locked: false,
    };
  });
}

/** Gold for the selected request's best bag match, or null. */
export function requestPayoutFor(
  ctx: GearPanelContext,
  save: SaveGame,
  index: number | null,
): number | null {
  if (!ctx.shop || index === null) return null;
  const request = traderRequests(ctx, save)[index];
  if (!request) return null;
  const best = requestMatchesInBag(save, ctx.catalog, request)[0];
  return best ? requestPayout(best, ctx.shop.ctx.shops.trader.requests) : null;
}

/** Detail box for the selected request, or how requests work when none is. */
export function requestDetail(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): DetailView {
  const d = emptyDetail();
  if (!ctx.shop) return d;
  const pct = payoutPct(ctx);
  const request =
    state.selectedOffer === null
      ? undefined
      : traderRequests(ctx, save)[state.selectedOffer];
  if (!request) {
    d.name = "Trader wants";
    d.subline = "Tap a request to see what you could sell.";
    d.info = [
      `The trader pays ${pct}% of an item's value for one item on this list.`,
      "New requests every night, picked from every item in the game, so you may never find a match.",
      "Only bag items count; unequip gear first to sell it here.",
    ];
    return d;
  }
  const { name, color } = describeRequest(ctx.catalog, request);
  const type = requestItemType(ctx.catalog, request);
  const config = ctx.shop.ctx.shops.trader.requests;
  const matches = requestMatchesInBag(save, ctx.catalog, request);
  d.tile = { icon: type ? iconForItemType(type) : "coins", color, badge: "" };
  d.name = name;
  d.nameColor = color;
  d.subline = `${kindLabel(request)} · pays ${pct}% of the item's value`;
  d.info = matches.length
    ? [
        `In your bag: ${matches
          .slice(0, 3)
          .map((m) => `${m.name} (${requestPayout(m, config)}g)`)
          .join(", ")}`,
        "Selling uses up the request.",
      ]
    : ["Nothing in your bag matches (equipped gear doesn't count)."];
  return d;
}

/** Action bar on the Wants tab: sell the best match. */
export function requestActions(
  ctx: GearPanelContext,
  save: SaveGame,
  state: GearPanelState,
): ActionView[] {
  const payout = requestPayoutFor(ctx, save, state.selectedOffer);
  return [
    {
      id: "fill",
      label: payout !== null ? `Sell to trader · ${payout}g` : "Sell to trader",
      icon: "coins",
      style: "sell",
      enabled: payout !== null,
    },
  ];
}
