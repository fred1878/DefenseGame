/**
 * Pure view model for the campaign night-end panel: one row per kept drop with a
 * Better / Worse / Same / Mixed / New verdict against what is worn, and the
 * loss-screen Tips built only from real save + data state.
 */
import type { BuildingDef } from "../../core/data/DataStore";
import type { SaveGame } from "../../core/save/saveTypes";
import { compareGear } from "../../gear/gearCompare";
import type { GearCatalog, SaveGear } from "../../gear/gearTypes";
import {
  bagItems,
  equipItem,
  equippedSlotOf,
  targetSlotFor,
} from "../../gear/inventory";
import { resolveItem } from "../../gear/itemStats";
import type { UiIconName } from "../icons/uiIcons";
import {
  itemKeyStat,
  itemTile,
  itemTypeShort,
  ownedItemCompare,
  type CompareView,
  type TileView,
} from "./gearPanelView";

export type DropVerdict = "better" | "worse" | "same" | "mixed" | "new";

export const VERDICT_LABEL: Record<DropVerdict, string> = {
  better: "Better",
  worse: "Worse",
  same: "Same",
  mixed: "Mixed",
  new: "New",
};

/** `dg-v-*` sprite for each verdict (public/assets/ui/itch). */
export const VERDICT_PART = {
  better: "dg-v-up",
  worse: "dg-v-down",
  same: "dg-v-same",
  mixed: "dg-v-mixed",
  new: "dg-v-new",
} as const;

/** Uids of drops added to the bag by the night (new uids since `before`). */
export function keptDropUids(before: SaveGear, after: SaveGear): number[] {
  return after.items
    .filter((i) => i.uid >= before.nextUid)
    .map((i) => i.uid)
    .sort((a, b) => a - b);
}

/** Verdict for equipping bag item `uid` over what the target slot holds now. */
export function dropVerdict(
  catalog: GearCatalog,
  gear: SaveGear,
  uid: number,
): DropVerdict {
  const item = gear.items.find((i) => i.uid === uid);
  if (!item) return "same";
  const slot = targetSlotFor(catalog, gear, item);
  if (slot && gear.equipped[slot] === undefined) return "new";
  const rows = compareGear(catalog, gear, equipItem(catalog, gear, uid));
  if (rows.length === 0) return "same";
  const better = rows.filter((r) => r.better).length;
  if (better === rows.length) return "better";
  if (better === 0) return "worse";
  return "mixed";
}

export type NightDropRow = {
  uid: number;
  name: string;
  color: string;
  /** "Magic legs · ilvl 5" (or "Equipped" once worn). */
  sub: string;
  stat: string;
  tile: TileView;
  verdict: DropVerdict;
  equipped: boolean;
};

export function nightDropRow(
  catalog: GearCatalog,
  gear: SaveGear,
  uid: number,
): NightDropRow | null {
  const item = gear.items.find((i) => i.uid === uid);
  const r = item ? resolveItem(catalog, item) : null;
  if (!r) return null;
  const equipped = equippedSlotOf(gear, uid) !== undefined;
  return {
    uid,
    name: r.name,
    color: r.rarity.color,
    sub: equipped
      ? "Equipped"
      : `${r.rarity.label} ${itemTypeShort(r.base.type).toLowerCase()} · ilvl ${r.item.itemLevel}`,
    stat: itemKeyStat(r),
    tile: itemTile(r),
    verdict: equipped ? "same" : dropVerdict(catalog, gear, uid),
    equipped,
  };
}

/** Rows for the kept drops, in drop order. */
export function nightDropRows(
  catalog: GearCatalog,
  gear: SaveGear,
  uids: readonly number[],
): NightDropRow[] {
  const out: NightDropRow[] = [];
  for (const uid of uids) {
    const row = nightDropRow(catalog, gear, uid);
    if (row) out.push(row);
  }
  return out;
}

/** "i" tooltip content: the same compare the Inventory shows. */
export function nightDropCompare(
  catalog: GearCatalog,
  gear: SaveGear,
  uid: number,
): CompareView {
  return ownedItemCompare(catalog, gear, uid);
}

/**
 * Equip a drop from the win panel. Always a swap (the worn item goes back to
 * the bag), so it never needs a free bag slot.
 */
export function equipNightDrop(
  catalog: GearCatalog,
  save: SaveGame,
  uid: number,
): SaveGame {
  const gear = equipItem(catalog, save.gear, uid);
  return gear === save.gear ? save : { ...save, gear };
}

export type NightTip = { icon: UiIconName; title: string; body: string };

export type NightTipsInput = {
  save: SaveGame;
  catalog: GearCatalog;
  buildings: Readonly<Record<string, BuildingDef>>;
  wallHpPerLevel: number;
  /** Town menu names (`town_buildings.json` labels), e.g. "Witchlight Beacon". */
  wallBuildingName: string;
  blacksmithName: string;
  traderName: string;
};

function nextLevelCost(
  buildings: Readonly<Record<string, BuildingDef>>,
  save: SaveGame,
  id: string,
): number | null {
  const def = buildings[id];
  if (!def) return null;
  const level = save.buildings[id] ?? 0;
  if (level >= def.maxLevel) return null;
  return def.costByLevel[level] ?? null;
}

/** Up to two tips for the lost-night panel, all from live save / data values. */
export function nightLossTips(input: NightTipsInput): NightTip[] {
  const { save, catalog, buildings } = input;
  const tips: NightTip[] = [];
  const wallCost = nextLevelCost(buildings, save, "wall");
  if (wallCost !== null) {
    const afford = save.gold >= wallCost ? "" : ` · ${wallCost}g`;
    tips.push({
      icon: "shield",
      title: "Raise the wall",
      body: `${input.wallBuildingName} · next level +${input.wallHpPerLevel} wall HP${afford}`,
    });
  }
  const better = bagItems(save.gear).filter(
    (i) => dropVerdict(catalog, save.gear, i.uid) === "better",
  ).length;
  if (better > 0) {
    tips.push({
      icon: "star",
      title: "Wear your best gear",
      body:
        better === 1
          ? "1 item in your bag beats what you wear"
          : `${better} items in your bag beat what you wear`,
    });
  }
  for (const [id, name] of [
    ["blacksmith", input.blacksmithName],
    ["trader", input.traderName],
  ] as const) {
    if (tips.length >= 2) break;
    const cost = nextLevelCost(buildings, save, id);
    if (cost !== null && save.gold >= cost) {
      tips.push({
        icon: "hammer",
        title: `Upgrade the ${id === "blacksmith" ? "Blacksmith" : "Trader"}`,
        body: `${name} · next level ${cost}g`,
      });
    }
  }
  if (tips.length < 2) {
    tips.push({
      icon: "hammer",
      title: "Visit the Blacksmith",
      body: `${input.blacksmithName} · spend your ${save.gold} gold on gear`,
    });
  }
  return tips.slice(0, 2);
}
