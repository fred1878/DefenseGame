export type DamageFlavor = "default" | "fire";

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