export type DamageFlavor = "default" | "fire" | "physical" | "frost";

/** White hit-flash tint for sword arcs and enemy melee (see `HitFlash.ts`). */
export const MELEE_HIT_FLAVOR: DamageFlavor = "physical";

/** Keeps explicit spell flavors from data; maps unset/`default` swing rows to melee physical. */
export function swingSpellDamageFlavor(
  fromSpell?: DamageFlavor,
): DamageFlavor {
  if (fromSpell && fromSpell !== "default") return fromSpell;
  return MELEE_HIT_FLAVOR;
}

export type Damageable = {
  id: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  team: "player" | "enemy";
  onDeath?: () => void;
  onDamaged?: (amount: number, flavor: DamageFlavor) => void;
};

export function applyDamage(
  target: Damageable,
  amount: number,
  flavor: DamageFlavor = "default",
): void {
  if (!target.alive || amount <= 0) return;
  target.hp = Math.max(0, target.hp - amount);
  target.onDamaged?.(amount, flavor);
  if (target.hp <= 0) {
    target.alive = false;
    target.onDeath?.();
  }
}