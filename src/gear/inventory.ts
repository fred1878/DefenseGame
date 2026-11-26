import { equipSlotsForType, type ItemDraft } from "./itemGen";
import { resolveItem, type ResolvedItem } from "./itemStats";
import {
  EQUIP_SLOTS,
  RARITY_IDS,
  type EquipSlot,
  type GearCatalog,
  type ItemInstance,
  type SaveGear,
} from "./gearTypes";

export function findItem(
  gear: SaveGear,
  uid: number,
): ItemInstance | undefined {
  return gear.items.find((i) => i.uid === uid);
}

/** Slot the item is equipped in, if any. */
export function equippedSlotOf(
  gear: SaveGear,
  uid: number,
): EquipSlot | undefined {
  return EQUIP_SLOTS.find((s) => gear.equipped[s] === uid);
}

/** Owned items that are not equipped. */
export function bagItems(gear: SaveGear): ItemInstance[] {
  const equipped = new Set(Object.values(gear.equipped));
  return gear.items.filter((i) => !equipped.has(i.uid));
}

export function addItem(
  gear: SaveGear,
  draft: ItemDraft,
): { gear: SaveGear; uid: number } {
  const uid = gear.nextUid;
  return {
    gear: {
      ...gear,
      items: [...gear.items, { ...draft, uid }],
      nextUid: uid + 1,
    },
    uid,
  };
}

/** Remove an item (unequipping it first). */
export function removeItem(gear: SaveGear, uid: number): SaveGear {
  const slot = equippedSlotOf(gear, uid);
  const equipped = { ...gear.equipped };
  if (slot) delete equipped[slot];
  return {
    ...gear,
    items: gear.items.filter((i) => i.uid !== uid),
    equipped,
  };
}

/** Slot an item would go into: its own slot, or the first empty ring / trinket slot. */
export function targetSlotFor(
  catalog: GearCatalog,
  gear: SaveGear,
  item: ItemInstance,
): EquipSlot | undefined {
  const base = catalog.bases[item.baseId];
  if (!base) return undefined;
  const slots = equipSlotsForType(base.type);
  const current = equippedSlotOf(gear, item.uid);
  if (current) return current;
  return slots.find((s) => gear.equipped[s] === undefined) ?? slots[0];
}

/** Equip an owned item; whatever was in the slot goes back to the bag. */
export function equipItem(
  catalog: GearCatalog,
  gear: SaveGear,
  uid: number,
  slot?: EquipSlot,
): SaveGear {
  const item = findItem(gear, uid);
  if (!item) return gear;
  const base = catalog.bases[item.baseId];
  if (!base) return gear;
  const target = slot ?? targetSlotFor(catalog, gear, item);
  if (!target || !equipSlotsForType(base.type).includes(target)) return gear;
  const equipped = { ...gear.equipped };
  const from = equippedSlotOf(gear, uid);
  if (from) delete equipped[from];
  equipped[target] = uid;
  return { ...gear, equipped };
}

export function unequipSlot(gear: SaveGear, slot: EquipSlot): SaveGear {
  if (gear.equipped[slot] === undefined) return gear;
  const equipped = { ...gear.equipped };
  delete equipped[slot];
  return { ...gear, equipped };
}

export const ITEM_SORT_MODES = ["slot", "rarity", "value", "level"] as const;
export type ItemSortMode = (typeof ITEM_SORT_MODES)[number];

export function nextSortMode(mode: ItemSortMode): ItemSortMode {
  const i = ITEM_SORT_MODES.indexOf(mode);
  return ITEM_SORT_MODES[(i + 1) % ITEM_SORT_MODES.length]!;
}

const TYPE_ORDER = [
  "meleeWeapon",
  "rangedWeapon",
  "helm",
  "chest",
  "hands",
  "legs",
  "boots",
  "ring",
  "trinket",
];

/** Resolve and sort items for display (unresolvable items are dropped). */
export function sortItems(
  catalog: GearCatalog,
  items: readonly ItemInstance[],
  mode: ItemSortMode,
): ResolvedItem[] {
  const resolved = items
    .map((i) => resolveItem(catalog, i))
    .filter((r): r is ResolvedItem => r !== null);
  const rarityRank = (r: ResolvedItem) => RARITY_IDS.indexOf(r.item.rarity);
  const typeRank = (r: ResolvedItem) => TYPE_ORDER.indexOf(r.base.type);
  const keys: Record<ItemSortMode, (r: ResolvedItem) => number[]> = {
    slot: (r) => [typeRank(r), -r.item.itemLevel, -rarityRank(r)],
    rarity: (r) => [-rarityRank(r), -r.price],
    value: (r) => [-r.price],
    level: (r) => [-r.item.itemLevel, -rarityRank(r)],
  };
  const key = keys[mode];
  return resolved.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      const d = ka[i]! - kb[i]!;
      if (d !== 0) return d;
    }
    return a.item.uid - b.item.uid;
  });
}
