export const DAMAGE_FLAVORS = [
  "fire",
  "frost",
  "physical",
  "water",
] as const;

export type DamageFlavor = (typeof DAMAGE_FLAVORS)[number];

/** Melee hit-flash flavor for sword arcs and enemy melee (see `hit-flash.json`). */
export const MELEE_HIT_FLAVOR: DamageFlavor = "physical";

/** Keeps explicit spell flavors from data; maps unset swing rows to melee physical. */
export function swingSpellDamageFlavor(
  fromSpell?: DamageFlavor,
): DamageFlavor {
  if (fromSpell) return fromSpell;
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
  flavor: DamageFlavor,
): void {
  if (!target.alive || amount <= 0) return;
  target.hp = Math.max(0, target.hp - amount);
  target.onDamaged?.(amount, flavor);
  if (target.hp <= 0) {
    target.alive = false;
    target.onDeath?.();
  }
}