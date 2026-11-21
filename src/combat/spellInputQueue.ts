import type { SpellId } from "../content/spells";
import type { SpellDefinition } from "../content/spells";
import { SPELL_MOVE_INTERRUPT_EPS } from "../content/spellTargeting";

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
   * Returns the queued manual spell to cast when attacks are idle, or null when
   * the queue is empty or the spell is unknown. Manual windup/channel casts may
   * start while the stick is active (movement is suppressed for the cast).
   */
  consumeIfReady(
    _stickX: number,
    _stickY: number,
    lookup: (id: SpellId) => SpellDefinition | undefined,
  ): SpellId | null {
    if (!this.queued) return null;
    const spellId = this.queued;
    const def = lookup(spellId);
    if (!def) {
      this.queued = null;
      return null;
    }
    this.queued = null;
    return spellId;
  }
}