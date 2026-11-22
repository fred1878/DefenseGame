import type { DamageFlavor } from "./DamageSystem";
import type { EnemySpellStatusMap } from "./enemySpellStatus";
import type { SpellOnHitEffects } from "../content/spells";

export function applySpellOnHitEffects(
  status: EnemySpellStatusMap,
  enemyId: string,
  onHit: SpellOnHitEffects,
  dotFlavor: DamageFlavor,
): void {
  if (onHit.rootMs && onHit.rootMs > 0) {
    status.applyRoot(enemyId, onHit.rootMs);
  }
  if (onHit.stunMs && onHit.stunMs > 0) {
    status.applyStun(enemyId, onHit.stunMs);
  }
  if (onHit.slowPct && onHit.slowPct > 0 && onHit.slowMs && onHit.slowMs > 0) {
    status.applySlow(enemyId, onHit.slowPct, onHit.slowMs);
  }
  if (onHit.dotDps && onHit.dotDps > 0 && onHit.dotMs && onHit.dotMs > 0) {
    status.applyDot(enemyId, onHit.dotDps, onHit.dotMs, dotFlavor);
  }
}