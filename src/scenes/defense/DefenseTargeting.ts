import Phaser from "phaser";
import type { AttackMode } from "../../config";
import { PLAYER_TUNING } from "../../config";
import type { EnemyInstance } from "../../entities/Enemy";
import type { Player } from "../../entities/Player";
import { FOCUS_SELECT_LOCK_MS } from "../../input/inputTuning";
import { defensePlayAreaLayout } from "../../ui/screenLayout";
import type { SafeInsets } from "../../ui/screenLayout";
import type { TargetIndicator } from "../../ui/TargetIndicator";

export type DefenseTargetingHost = {
  scene: Phaser.Scene;
  registry: Phaser.Data.DataManager;
  scale: Phaser.Scale.ScaleManager;
  input: Phaser.Input.InputPlugin;
  player: Player;
  /** Live list — DefenseScene may reassign `enemies` when culling dead units. */
  getEnemies: () => EnemyInstance[];
  targetIndicator: TargetIndicator;
  uiBlockers: Phaser.GameObjects.GameObject[];
  safe: SafeInsets;
  wu: (atDefault2x: number) => number;
};

/** Tap-to-focus, facing targets, and HUD hit tests (REFACTOR_PLAN PR5). */
export class DefenseTargeting {
  focusEnemyId: string | null = null;
  focusSelectLockMs = 0;

  constructor(private readonly host: DefenseTargetingHost) {}

  resetForNewRun(): void {
    this.focusEnemyId = null;
    this.focusSelectLockMs = 0;
  }

  getEnemyById(id: string): EnemyInstance | undefined {
    return this.host.getEnemies().find((e) => e.id === id);
  }

  findEnemyNearWorldPoint(
    worldX: number,
    worldY: number,
  ): EnemyInstance | null {
    const r = this.host.wu(PLAYER_TUNING.targetTapRadiusWu);
    let best: { e: EnemyInstance; d: number } | null = null;
    for (const e of this.host.getEnemies()) {
      if (!e.damageable.alive) continue;
      const d = Phaser.Math.Distance.Between(
        worldX,
        worldY,
        e.sprite.x,
        e.sprite.y,
      );
      if (d > r) continue;
      if (!best || d < best.d) best = { e, d };
    }
    return best?.e ?? null;
  }

  trySelectEnemyAt(worldX: number, worldY: number): void {
    const pick = this.findEnemyNearWorldPoint(worldX, worldY);
    if (pick) {
      this.setFocusEnemy(pick.id);
      return;
    }
    this.setFocusEnemy(null);
  }

  setFocusEnemy(id: string | null): void {
    if (id) this.focusSelectLockMs = FOCUS_SELECT_LOCK_MS;
    this.focusEnemyId = id;
    if (!id) {
      this.host.targetIndicator.detach();
      return;
    }
    const enemy = this.getEnemyById(id);
    if (!enemy?.damageable.alive) {
      this.focusEnemyId = null;
      this.host.targetIndicator.detach();
      return;
    }
    this.host.targetIndicator.attachTo(enemy.sprite);
    this.host.targetIndicator.updateWorldPosition();
  }

  syncFocusTarget(): void {
    if (!this.focusEnemyId) return;
    const enemy = this.getEnemyById(this.focusEnemyId);
    if (!enemy?.damageable.alive) {
      this.setFocusEnemy(null);
      return;
    }
    this.host.targetIndicator.updateWorldPosition();
  }

  /** Selected enemy if alive; else nearest in range. Manual allows focus out of range for facing. */
  facingTarget(
    mode: AttackMode | "melee" | "ranged",
    manual: boolean,
  ): { x: number; y: number } | null {
    const strike: "melee" | "ranged" = mode === "auto" ? "ranged" : mode;
    const focused = this.focusedEnemyPosition(strike, manual);
    if (focused) return focused;
    return this.nearestEnemyForMode(strike);
  }

  private focusedEnemyPosition(
    mode: "melee" | "ranged",
    manual: boolean,
  ): { x: number; y: number } | null {
    if (!this.focusEnemyId) return null;
    const e = this.getEnemyById(this.focusEnemyId);
    if (!e?.damageable.alive) return null;
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
    const maxR =
      mode === "melee"
        ? this.host.wu(PLAYER_TUNING.autoAttackMeleeRange)
        : this.host.wu(PLAYER_TUNING.autoAttackRangedRange);
    if (!manual && d > maxR) return null;
    return { x: e.sprite.x, y: e.sprite.y };
  }

  nearestEnemyForMode(
    mode: "melee" | "ranged",
  ): { x: number; y: number } | null {
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const maxR =
      mode === "melee"
        ? this.host.wu(PLAYER_TUNING.autoAttackMeleeRange)
        : this.host.wu(PLAYER_TUNING.autoAttackRangedRange);
    let best: { x: number; y: number; d: number } | null = null;
    for (const e of this.host.getEnemies()) {
      if (!e.damageable.alive) continue;
      const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
      if (d > maxR) continue;
      if (!best || d < best.d) {
        best = { x: e.sprite.x, y: e.sprite.y, d };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  isPointerOverUi(pointer: Phaser.Input.Pointer): boolean {
    const playTop = defensePlayAreaLayout(
      this.host.scene,
      this.host.safe,
    ).topBandBottom;
    if (
      pointer.y < playTop &&
      pointer.x >= 0 &&
      pointer.x <= this.host.scale.width
    ) {
      return true;
    }
    const hits = this.host.input.hitTestPointer(pointer);
    for (const hit of hits) {
      if (this.host.uiBlockers.some((b) => this.isSameOrChild(hit, b)))
        return true;
    }
    return false;
  }

  private isSameOrChild(
    hit: Phaser.GameObjects.GameObject,
    blocker: Phaser.GameObjects.GameObject,
  ): boolean {
    if (hit === blocker) return true;
    if (blocker instanceof Phaser.GameObjects.Container) {
      if (blocker.list.includes(hit)) return true;
    }
    let node: Phaser.GameObjects.GameObject | null = hit;
    while (node) {
      if (node === blocker) return true;
      const parent: Phaser.GameObjects.Container | null =
        (
          node as Phaser.GameObjects.GameObject & {
            parentContainer?: Phaser.GameObjects.Container;
          }
        ).parentContainer ?? null;
      node = parent;
    }
    return false;
  }
}

/** Vitest-friendly geometry: enemy pick at a world point. */
export function findEnemyNearWorldPointPure(
  enemies: Array<{ id: string; x: number; y: number; alive: boolean }>,
  worldX: number,
  worldY: number,
  radius: number,
): string | null {
  let best: { id: string; d: number } | null = null;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Phaser.Math.Distance.Between(worldX, worldY, e.x, e.y);
    if (d > radius) continue;
    if (!best || d < best.d) best = { id: e.id, d };
  }
  return best?.id ?? null;
}
