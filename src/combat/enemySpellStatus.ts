export type EnemySpellStatus = {
  rootRemainingMs: number;
};

export class EnemySpellStatusMap {
  private readonly byEnemyId = new Map<string, EnemySpellStatus>();

  applyRoot(enemyId: string, durationMs: number): void {
    const prev = this.byEnemyId.get(enemyId);
    this.byEnemyId.set(enemyId, {
      rootRemainingMs: Math.max(durationMs, prev?.rootRemainingMs ?? 0),
    });
  }

  isRooted(enemyId: string): boolean {
    return (this.byEnemyId.get(enemyId)?.rootRemainingMs ?? 0) > 0;
  }

  tick(deltaMs: number): void {
    for (const [id, status] of this.byEnemyId) {
      status.rootRemainingMs = Math.max(0, status.rootRemainingMs - deltaMs);
      if (status.rootRemainingMs <= 0) this.byEnemyId.delete(id);
    }
  }
}