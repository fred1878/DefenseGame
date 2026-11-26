import {
  describeRequest,
  requestMatchesInBag,
  requestPayout,
  type BuyRequest,
} from "../../gear/buyRequests";
import type { SaveGame } from "../../core/saveTypes";
import type { GearPanelContext } from "./gearPanelLogic";
import type { PanelRow } from "./shopPanelLogic";

export type RequestDetail = {
  name: string;
  color: string;
  lines: string[];
  /** Gold for the best matching bag item, or null when nothing matches. */
  payout: number | null;
};

function requests(ctx: GearPanelContext, save: SaveGame): BuyRequest[] {
  return ctx.shop?.id === "trader" ? (save.shops.requests ?? []) : [];
}

function kindLabel(request: BuyRequest): string {
  if (request.kind === "base") return "Any rarity";
  if (request.kind === "unique") return "Unique";
  return "Any item of this type";
}

/** Requests tab rows: what the trader wants and what you could sell now. */
export function requestRows(ctx: GearPanelContext, save: SaveGame): PanelRow[] {
  const shop = ctx.shop;
  if (!shop) return [];
  const config = shop.ctx.shops.trader.requests;
  return requests(ctx, save).map((request, key) => {
    const { name, color } = describeRequest(ctx.catalog, request);
    const best = requestMatchesInBag(save, ctx.catalog, request)[0];
    const pays = `Pays ${config.payoutPct}%`;
    return {
      key,
      name,
      color,
      meta: best
        ? `${pays} · ${best.name} → ${requestPayout(best, config)}g`
        : `${kindLabel(request)} · ${pays} · no match in bag`,
    };
  });
}

/** Detail box for a selected request. */
export function requestDetail(
  ctx: GearPanelContext,
  save: SaveGame,
  index: number | null,
): RequestDetail | null {
  const shop = ctx.shop;
  if (!shop || index === null) return null;
  const request = requests(ctx, save)[index];
  if (!request) return null;
  const config = shop.ctx.shops.trader.requests;
  const { name, color } = describeRequest(ctx.catalog, request);
  const matches = requestMatchesInBag(save, ctx.catalog, request);
  const lines = [
    `The trader wants: ${name} (${kindLabel(request).toLowerCase()}).`,
    `Pays ${config.payoutPct}% of the item's value for one item.`,
    "New requests every night. No promise you'll find one.",
  ];
  if (matches.length) {
    lines.push(
      `In your bag: ${matches
        .slice(0, 3)
        .map((m) => `${m.name} (${requestPayout(m, config)}g)`)
        .join(", ")}`,
    );
  } else {
    lines.push("Nothing in your bag matches (equipped gear doesn't count).");
  }
  return {
    name,
    color,
    lines,
    payout: matches[0] ? requestPayout(matches[0], config) : null,
  };
}
