import {
  applyDamage,
  type Damageable,
  type DamageFlavor,
} from "./DamageSystem";

export type EnemySpellStatus = {
  rootRemainingMs: number;
  stunRemainingMs: number;
  slowPct: number;
  slowRemainingMs: number;
  dotDps: number;
  dotRemainingMs: number;
  dotFlavor: DamageFlavor;
  dotTickAccumMs: number;
};

const DOT_TICK_MS = 250;

export class EnemySpellStatusMap {
  private readonly byEnemyId = new Map<string, EnemySpellStatus>();

  private ensure(enemyId: string): EnemySpellStatus {
    let s = this.byEnemyId.get(enemyId);
    if (!s) {
      s = {
        rootRemainingMs: 0,
        stunRemainingMs: 0,
        slowPct: 0,
        slowRemainingMs: 0,
        dotDps: 0,
        dotRemainingMs: 0,
        dotFlavor: "physical",
        dotTickAccumMs: 0,
      };
      this.byEnemyId.set(enemyId, s);
    }
    return s;
  }

  applyRoot(enemyId: string, durationMs: number): void {
    const s = this.ensure(enemyId);
    s.rootRemainingMs = Math.max(durationMs, s.rootRemainingMs);
  }

  applyStun(enemyId: string, durationMs: number): void {
    const s = this.ensure(enemyId);
    s.stunRemainingMs = Math.max(durationMs, s.stunRemainingMs);
  }

  applySlow(enemyId: string, slowPct: number, durationMs: number): void {
    const s = this.ensure(enemyId);
    s.slowPct = Math.max(slowPct, s.slowPct);
    s.slowRemainingMs = Math.max(durationMs, s.slowRemainingMs);
  }

  applyDot(
    enemyId: string,
    dotDps: number,
    durationMs: number,
    flavor: DamageFlavor,
  ): void {
    const s = this.ensure(enemyId);
    s.dotDps = Math.max(dotDps, s.dotDps);
    s.dotRemainingMs = Math.max(durationMs, s.dotRemainingMs);
    s.dotFlavor = flavor;
  }

  isRooted(enemyId: string): boolean {
    return (this.byEnemyId.get(enemyId)?.rootRemainingMs ?? 0) > 0;
  }

  isStunned(enemyId: string): boolean {
    return (this.byEnemyId.get(enemyId)?.stunRemainingMs ?? 0) > 0;
  }

  moveSpeedMultiplier(enemyId: string): number {
    const s = this.byEnemyId.get(enemyId);
    if (!s || s.slowRemainingMs <= 0) return 1;
    return Math.max(0.1, 1 - s.slowPct);
  }

  tick(
    deltaMs: number,
    applyDotDamage?: (
      enemyId: string,
      amount: number,
      flavor: DamageFlavor,
    ) => void,
  ): void {
    for (const [id, status] of this.byEnemyId) {
      status.rootRemainingMs = Math.max(0, status.rootRemainingMs - deltaMs);
      status.stunRemainingMs = Math.max(0, status.stunRemainingMs - deltaMs);
      status.slowRemainingMs = Math.max(0, status.slowRemainingMs - deltaMs);
      if (status.slowRemainingMs <= 0) status.slowPct = 0;

      if (status.dotRemainingMs > 0 && status.dotDps > 0 && applyDotDamage) {
        status.dotRemainingMs = Math.max(0, status.dotRemainingMs - deltaMs);
        status.dotTickAccumMs += deltaMs;
        while (status.dotTickAccumMs >= DOT_TICK_MS) {
          status.dotTickAccumMs -= DOT_TICK_MS;
          const amt = status.dotDps * (DOT_TICK_MS / 1000);
          applyDotDamage(id, amt, status.dotFlavor);
        }
        if (status.dotRemainingMs <= 0) {
          status.dotDps = 0;
          status.dotTickAccumMs = 0;
        }
      }

      if (
        status.rootRemainingMs <= 0 &&
        status.stunRemainingMs <= 0 &&
        status.slowRemainingMs <= 0 &&
        status.dotRemainingMs <= 0
      ) {
        this.byEnemyId.delete(id);
      }
    }
  }

  /** Direct tick helper for unit tests. */
  applyDotTickToDamageable(enemyId: string, damageable: Damageable): void {
    const s = this.byEnemyId.get(enemyId);
    if (!s || s.dotDps <= 0) return;
    applyDamage(damageable, s.dotDps * (DOT_TICK_MS / 1000), s.dotFlavor);
  }
}
