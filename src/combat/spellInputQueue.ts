import { STICK_MOVING_MAGNITUDE_EPS } from "../config/spellInput";
import type { SpellId } from "../content/spells";
import type { SpellDefinition } from "../content/spells";

export { STICK_MOVING_MAGNITUDE_EPS as spellQueueMoveEpsilon };

export function isStickMoving(stickX: number, stickY: number): boolean {
  return Math.hypot(stickX, stickY) > STICK_MOVING_MAGNITUDE_EPS;
}

export type QueuedCombatInput =
  | { kind: "spell"; spellId: SpellId }
  | { kind: "manual_attack" };

/**
 * Holds at most one manual spell or ATK press while the player attack FSM is busy.
 * A newer press replaces any existing queued input.
 */
export class SpellInputQueue {
  private queued: QueuedCombatInput | null = null;

  peek(): QueuedCombatInput | null {
    return this.queued;
  }

  enqueue(spellId: SpellId): void {
    this.queued = { kind: "spell", spellId };
  }

  enqueueManualAttack(): void {
    this.queued = { kind: "manual_attack" };
  }

  clear(): void {
    this.queued = null;
  }

  /**
   * Returns the queued manual input when attacks are idle, or null when the queue
   * is empty or a queued spell is unknown. Manual windup/channel casts may start
   * while the stick is active (movement is suppressed for the cast).
   */
  consumeIfReady(
    _stickX: number,
    _stickY: number,
    lookup: (id: SpellId) => SpellDefinition | undefined,
  ): QueuedCombatInput | null {
    if (!this.queued) return null;
    if (this.queued.kind === "manual_attack") {
      const item = this.queued;
      this.queued = null;
      return item;
    }
    const spellId = this.queued.spellId;
    const def = lookup(spellId);
    if (!def) {
      this.queued = null;
      return null;
    }
    this.queued = null;
    return { kind: "spell", spellId };
  }
}
