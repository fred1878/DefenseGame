import {
  spellById,
  type SpellDefinition,
  type SpellId,
} from "../content/spells";
import {
  SPELL_MOVE_INTERRUPT_EPS,
  spellCastMs,
} from "../content/spellTargeting";

export type ChannelUpdateResult =
  | { type: "idle" }
  | { type: "windup"; progress: number; spellId: SpellId }
  | { type: "channeling"; progress: number; spellId: SpellId }
  | { type: "interrupted"; spellId: SpellId }
  | { type: "completed"; spellId: SpellId; def: SpellDefinition };

export class SpellCastController {
  private activeSpellId: SpellId | null = null;
  private windupElapsedMs = 0;
  private windupDurationMs = 0;
  private channelElapsedMs = 0;
  private channelDurationMs = 0;
  private inChannel = false;
  private readonly cooldownRemainingMs = new Map<SpellId, number>();

  isChanneling(): boolean {
    return this.activeSpellId !== null;
  }

  getActiveSpellId(): SpellId | null {
    return this.activeSpellId;
  }

  getChannelProgress(): number {
    if (!this.activeSpellId) return 0;
    if (!this.inChannel) {
      if (this.windupDurationMs <= 0) return 0;
      return Math.min(1, this.windupElapsedMs / this.windupDurationMs);
    }
    if (this.channelDurationMs <= 0) return 1;
    return Math.min(1, this.channelElapsedMs / this.channelDurationMs);
  }

  /** Windup vs effect channel for HUD and cast bar styling. */
  getCastPhase(): "windup" | "channeling" | null {
    if (!this.activeSpellId) return null;
    if (this.inChannel) return "channeling";
    if (this.windupDurationMs > 0) return "windup";
    if (this.channelDurationMs > 0) return "channeling";
    return null;
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

  /** Begin windup, channel, or instant cast. Returns false if blocked. */
  tryBeginCast(spellId: SpellId): SpellDefinition | "channel" | "windup" | false {
    if (this.isChanneling()) return false;
    const def = spellById(spellId);
    if (!def) return false;
    if ((this.cooldownRemainingMs.get(spellId) ?? 0) > 0) return false;

    const castMs = spellCastMs(def);
    const hasChannel = def.channelMs > 0;

    if (castMs <= 0 && !hasChannel) {
      this.cooldownRemainingMs.set(spellId, def.cooldownMs);
      return def;
    }

    this.activeSpellId = spellId;
    this.windupElapsedMs = 0;
    this.windupDurationMs = castMs;
    this.channelElapsedMs = 0;
    this.channelDurationMs = hasChannel ? def.channelMs : 0;
    this.inChannel = castMs <= 0 && hasChannel;
    if (castMs > 0) return "windup";
    return "channel";
  }

  updateChannel(
    deltaMs: number,
    stickX: number,
    stickY: number,
  ): ChannelUpdateResult {
    if (!this.activeSpellId) return { type: "idle" };

    const mag = Math.hypot(stickX, stickY);
    if (mag > SPELL_MOVE_INTERRUPT_EPS) {
      const id = this.activeSpellId;
      this.clearCast();
      return { type: "interrupted", spellId: id };
    }

    const spellId = this.activeSpellId;

    if (!this.inChannel && this.windupDurationMs > 0) {
      this.windupElapsedMs += deltaMs;
      if (this.windupElapsedMs < this.windupDurationMs) {
        return {
          type: "windup",
          progress: this.getChannelProgress(),
          spellId,
        };
      }
      if (this.channelDurationMs > 0) {
        this.inChannel = true;
      } else {
        const def = spellById(spellId);
        this.clearCast();
        if (!def) return { type: "idle" };
        this.cooldownRemainingMs.set(spellId, def.cooldownMs);
        return { type: "completed", spellId, def };
      }
    }

    if (this.inChannel && this.channelDurationMs > 0) {
      this.channelElapsedMs += deltaMs;
      if (this.channelElapsedMs < this.channelDurationMs) {
        return {
          type: "channeling",
          progress: this.getChannelProgress(),
          spellId,
        };
      }
    }

    const def = spellById(spellId);
    this.clearCast();
    if (!def) return { type: "idle" };
    this.cooldownRemainingMs.set(spellId, def.cooldownMs);
    return { type: "completed", spellId, def };
  }

  cancelChannel(): void {
    this.clearCast();
  }

  private clearCast(): void {
    this.activeSpellId = null;
    this.windupElapsedMs = 0;
    this.windupDurationMs = 0;
    this.channelElapsedMs = 0;
    this.channelDurationMs = 0;
    this.inChannel = false;
  }
}