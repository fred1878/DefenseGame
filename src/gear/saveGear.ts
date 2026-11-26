import { equipSlotsForType } from "./itemGen";
import { resolveItem } from "./itemStats";
import {
  EQUIP_SLOTS,
  RARITY_IDS,
  type EquipSlot,
  type GearCatalog,
  type ItemInstance,
  type SaveGear,
} from "./gearTypes";

export function createEmptyGear(): SaveGear {
  return { items: [], equipped: {}, nextUid: 1 };
}

function isItemInstance(raw: unknown): raw is ItemInstance {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Partial<ItemInstance>;
  return (
    typeof r.uid === "number" &&
    typeof r.baseId === "string" &&
    typeof r.itemLevel === "number" &&
    RARITY_IDS.includes(r.rarity as ItemInstance["rarity"]) &&
    Array.isArray(r.affixes)
  );
}

/**
 * Repair a loaded gear block: drop items whose base / unique left the data,
 * duplicate uids, and equipped entries that point at missing or wrong-slot items.
 */
export function normalizeSaveGear(
  raw: Partial<SaveGear> | undefined,
  catalog: GearCatalog,
): SaveGear {
  const items: ItemInstance[] = [];
  const seen = new Set<number>();
  for (const it of Array.isArray(raw?.items) ? raw.items : []) {
    if (!isItemInstance(it) || seen.has(it.uid)) continue;
    if (!resolveItem(catalog, it)) continue;
    seen.add(it.uid);
    items.push({
      ...it,
      affixes: it.affixes.filter((a) => !!catalog.affixes[a.id]),
    });
  }
  const equipped: SaveGear["equipped"] = {};
  const usedUids = new Set<number>();
  const rawEquipped = raw?.equipped ?? {};
  for (const slot of EQUIP_SLOTS) {
    const uid = rawEquipped[slot];
    if (typeof uid !== "number" || usedUids.has(uid)) continue;
    const item = items.find((i) => i.uid === uid);
    const base = item ? catalog.bases[item.baseId] : undefined;
    if (!base || !equipSlotsForType(base.type).includes(slot as EquipSlot)) {
      continue;
    }
    equipped[slot] = uid;
    usedUids.add(uid);
  }
  const maxUid = items.reduce((m, i) => Math.max(m, i.uid), 0);
  const nextUid =
    typeof raw?.nextUid === "number" && raw.nextUid > maxUid
      ? raw.nextUid
      : maxUid + 1;
  return { items, equipped, nextUid };
}
