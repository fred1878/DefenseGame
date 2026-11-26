import { DAMAGE_FLAVORS } from "../combat/DamageSystem";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import {
  CONSUMABLE_KINDS,
  type BombDef,
  type ConsumableDef,
  type ConsumablesConfig,
} from "../gear/consumables";
import {
  ConfigLoadError,
  optionalFiniteNumber,
  requireNumberFields,
  requireRecord,
} from "./configValidation";
import { requireOneOf, requireString } from "./normalizeItems";

export const CONSUMABLES_ROW_BOOT_KEYS = [
  "items",
  "name",
  "kind",
  "price",
  "maxStack",
  "cooldownMs",
  "healHp",
  "bomb",
] as const;
export const CONSUMABLES_BOMB_BOOT_KEYS = [
  "damage",
  "radiusWu",
  "rangeWu",
  "flavor",
  "knockbackWu",
  "projectile",
  "blast",
  "dotDps",
  "dotMs",
  "slowPct",
  "slowMs",
  "stunMs",
] as const;

const FX_NAMES = Object.keys(
  COMBAT_FX_TEXTURE,
) as (keyof typeof COMBAT_FX_TEXTURE)[];

function normalizeBomb(raw: unknown, path: string): BombDef {
  const row = requireRecord(raw, path);
  const nums = requireNumberFields(
    row,
    ["damage", "radiusWu", "rangeWu", "knockbackWu"],
    path,
  ) as Pick<BombDef, "damage" | "radiusWu" | "rangeWu" | "knockbackWu">;
  const out: BombDef = {
    ...nums,
    flavor: requireOneOf(row.flavor, DAMAGE_FLAVORS, `${path}.flavor`),
    projectile:
      COMBAT_FX_TEXTURE[
        requireOneOf(row.projectile, FX_NAMES, `${path}.projectile`)
      ],
    blast:
      COMBAT_FX_TEXTURE[requireOneOf(row.blast, FX_NAMES, `${path}.blast`)],
  };
  for (const key of [
    "dotDps",
    "dotMs",
    "slowPct",
    "slowMs",
    "stunMs",
  ] as const) {
    const v = optionalFiniteNumber(row[key], `${path}.${key}`);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

function normalizeRow(id: string, raw: unknown): ConsumableDef {
  const path = `consumables.items.${id}`;
  const row = requireRecord(raw, path);
  const kind = requireOneOf(row.kind, CONSUMABLE_KINDS, `${path}.kind`);
  const nums = requireNumberFields(
    row,
    ["price", "maxStack", "cooldownMs"],
    path,
  ) as Pick<ConsumableDef, "price" | "maxStack" | "cooldownMs">;
  const def: ConsumableDef = {
    id,
    name: requireString(row.name, `${path}.name`),
    kind,
    ...nums,
  };
  if (kind === "heal") {
    const heal = optionalFiniteNumber(row.healHp, `${path}.healHp`);
    if (heal === undefined) {
      throw new ConfigLoadError(`Missing number at ${path}.healHp`);
    }
    def.healHp = heal;
  } else {
    def.bomb = normalizeBomb(row.bomb, `${path}.bomb`);
  }
  return def;
}

/** Validate `public/data/consumables.json` (potions and bombs). */
export function normalizeConsumables(raw: unknown): ConsumablesConfig {
  const root = requireRecord(raw, "consumables");
  const items = requireRecord(root.items, "consumables.items");
  return {
    items: Object.fromEntries(
      Object.entries(items).map(([id, row]) => [id, normalizeRow(id, row)]),
    ),
  };
}
