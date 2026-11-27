import type { DamageFlavor } from "../combat/DamageSystem";

/** Consumable shapes, shared by `gear/consumables` and `core/normalizeConsumables` (no runtime deps, so no cycle). */
export const CONSUMABLE_KINDS = ["heal", "bomb"] as const;
export type ConsumableKind = (typeof CONSUMABLE_KINDS)[number];

export type BombDef = {
  damage: number;
  radiusWu: number;
  rangeWu: number;
  flavor: DamageFlavor;
  knockbackWu: number;
  /** Texture key (resolved from a COMBAT_FX_TEXTURE name) for the thrown sprite. */
  projectile: string;
  /** Texture key for the blast flash. */
  blast: string;
  dotDps?: number;
  dotMs?: number;
  slowPct?: number;
  slowMs?: number;
  stunMs?: number;
};

export type ConsumableDef = {
  id: string;
  name: string;
  kind: ConsumableKind;
  price: number;
  maxStack: number;
  cooldownMs: number;
  healHp?: number;
  bomb?: BombDef;
};

export type ConsumablesConfig = { items: Record<string, ConsumableDef> };
