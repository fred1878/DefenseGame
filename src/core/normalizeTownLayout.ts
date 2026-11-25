import type { TownLayoutDef, TownLayoutSlot } from "./townBuildingTypes";
import {
  ConfigLoadError,
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";

export type TownLayoutInput = {
  buildingDisplayScale?: number;
  slots?: Partial<TownLayoutSlot>[];
};

export function normalizeTownLayout(
  raw: TownLayoutInput | null | undefined,
): TownLayoutDef {
  const root = requireRecord(raw, "town_layout");
  const buildingDisplayScale = requireFiniteNumber(
    root.buildingDisplayScale,
    "town_layout.buildingDisplayScale",
  );
  if (buildingDisplayScale < 1) {
    throw new ConfigLoadError(
      "town_layout.buildingDisplayScale must be >= 1",
    );
  }

  const slotsRaw = root.slots;
  if (!Array.isArray(slotsRaw)) {
    throw new ConfigLoadError("Missing or invalid array at town_layout.slots");
  }

  const slots: TownLayoutSlot[] = slotsRaw.map((item, index) => {
    const row = requireRecord(item, `town_layout.slots[${index}]`);
    const buildingId = row.buildingId;
    if (typeof buildingId !== "string" || buildingId.length === 0) {
      throw new ConfigLoadError(
        `Missing or invalid string at town_layout.slots[${index}].buildingId`,
      );
    }
    const x = requireFiniteNumber(row.x, `town_layout.slots[${index}].x`);
    const y = requireFiniteNumber(row.y, `town_layout.slots[${index}].y`);
    return { buildingId, x, y };
  });

  return { buildingDisplayScale, slots };
}