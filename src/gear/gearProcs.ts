import type { Damageable } from "../combat/rules/DamageSystem";
import { applyHealAmount } from "../combat/rules/SpellEffects";
import type { EnemySpellStatusMap } from "../combat/rules/enemySpellStatus";
import { gearWeaponProcs, takeLifestealHeal } from "./gearRuntime";
import type { Rng } from "./rng";

/** Lifesteal and on-hit procs after a weapon (melee or ranged auto-attack) hit. */
export function applyWeaponHitEffects(opts: {
  enemyId: string;
  damage: number;
  status: EnemySpellStatusMap;
  player: Damageable;
  rng?: Rng;
}): void {
  const rng = opts.rng ?? Math.random;
  const heal = takeLifestealHeal(opts.damage);
  if (heal > 0) applyHealAmount(opts.player, heal);
  for (const proc of gearWeaponProcs()) {
    if (rng() * 100 >= proc.chancePct) continue;
    if (proc.kind === "dot") {
      opts.status.applyDot(
        opts.enemyId,
        proc.dps,
        proc.ms,
        proc.flavor,
        "proc",
      );
    } else if (proc.kind === "slow") {
      opts.status.applySlow(opts.enemyId, proc.slowPct, proc.ms);
    } else {
      opts.status.applyStun(opts.enemyId, proc.ms);
    }
  }
}
