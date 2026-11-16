import type { SpellId } from "../content/spells";
import type { SpellDefinition } from "../content/spells";
import {
  SPELL_MOVE_INTERRUPT_EPS,
  spellRequiresStationary,
} from "../content/spellTargeting";

export { SPELL_MOVE_INTERRUPT_EPS as spellQueueMoveEpsilon };

export function isStickMoving(stickX: number, stickY: number): boolean {
  return Math.hypot(stickX, stickY) > SPELL_MOVE_INTERRUPT_EPS;
}

/**
 * Holds at most one manual spell press while the player attack FSM is busy.
 * A newer press replaces any existing queued spell.
 */
export class SpellInputQueue {
  private queued: SpellId | null = null;

  peek(): SpellId | null {
    return this.queued;
  }

  enqueue(spellId: SpellId): void {
    this.queued = spellId;
  }

  clear(): void {
    this.queued = null;
  }

  /**
   * Returns the queued spell to cast after an attack completes, or null when
   * the queue is empty, the spell is unknown, or a stationary-only spell would
   * start while the player is moving.
   */
  consumeIfReady(
    stickX: number,
    stickY: number,
    lookup: (id: SpellId) => SpellDefinition | undefined,
  ): SpellId | null {
    if (!this.queued) return null;
    const spellId = this.queued;
    const def = lookup(spellId);
    if (!def) {
      this.queued = null;
      return null;
    }
    const moving = isStickMoving(stickX, stickY);
    if (moving && spellRequiresStationary(def)) {
      this.queued = null;
      return null;
    }
    this.queued = null;
    return spellId;
  }
}