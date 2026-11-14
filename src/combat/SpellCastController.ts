import { spellById, type SpellDefinition, type SpellId } from "../config";

export type ChannelUpdateResult =
  | { type: "idle" }
  | { type: "channeling"; progress: number; spellId: SpellId }
  | { type: "interrupted"; spellId: SpellId }
  | { type: "completed"; spellId: SpellId; def: SpellDefinition };

const MOVE_INTERRUPT_EPS = 0.12;

export class SpellCastController {
  private channelSpellId: SpellId | null = null;
  private channelElapsedMs = 0;
  private channelDurationMs = 0;
  private readonly cooldownRemainingMs = new Map<SpellId, number>();

  isChanneling(): boolean {
    return this.channelSpellId !== null;
  }

  getChannelProgress(): number {
    if (!this.channelSpellId || this.channelDurationMs <= 0) return 0;
    return Math.min(1, this.channelElapsedMs / this.channelDurationMs);
  }

  getCooldownRemaining(spellId: SpellId): number {
    return this.cooldownRemainingMs.get(spellId) ?? 0;
  }

  tickCooldowns(deltaMs: number): void {
    for (const [id, ms] of this.cooldownRemainingMs) {
      const next = Math.max(0, ms - deltaMs);
      if (next <= 0) this.cooldownRemainingMs.delete(id);
      else this.cooldownRemainingMs.set(id, next);
    }
  }

  /** Begin instant cast or channel. Returns false if blocked. */
  tryBeginCast(spellId: SpellId): SpellDefinition | "channel" | false {
    if (this.isChanneling()) return false;
    const def = spellById(spellId);
    if (!def) return false;
    if ((this.cooldownRemainingMs.get(spellId) ?? 0) > 0) return false;

    if (def.kind === "instant" || def.channelMs <= 0) {
      this.cooldownRemainingMs.set(spellId, def.cooldownMs);
      return def;
    }

    this.channelSpellId = spellId;
    this.channelElapsedMs = 0;
    this.channelDurationMs = def.channelMs;
    return "channel";
  }

  updateChannel(
    deltaMs: number,
    stickX: number,
    stickY: number,
  ): ChannelUpdateResult {
    if (!this.channelSpellId) return { type: "idle" };

    const mag = Math.hypot(stickX, stickY);
    if (mag > MOVE_INTERRUPT_EPS) {
      const id = this.channelSpellId;
      this.clearChannel();
      return { type: "interrupted", spellId: id };
    }

    this.channelElapsedMs += deltaMs;
    const progress = this.getChannelProgress();
    if (this.channelElapsedMs < this.channelDurationMs) {
      return { type: "channeling", progress, spellId: this.channelSpellId };
    }

    const id = this.channelSpellId;
    const def = spellById(id);
    this.clearChannel();
    if (!def) return { type: "idle" };
    this.cooldownRemainingMs.set(id, def.cooldownMs);
    return { type: "completed", spellId: id, def };
  }

  cancelChannel(): void {
    this.clearChannel();
  }

  private clearChannel(): void {
    this.channelSpellId = null;
    this.channelElapsedMs = 0;
    this.channelDurationMs = 0;
  }
}