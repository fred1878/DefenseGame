import {
  spellById,
  type SpellDefinition,
  type SpellId,
} from "../content/spells";
import { spellCastMs } from "../content/spellTargeting";
import { stickDeflectionInterruptsCast } from "./spellStickInterrupt";

export type ChannelUpdateResult =
  | { type: "idle" }
  | { type: "windup"; progress: number; spellId: SpellId }
  | { type: "channeling"; progress: number; spellId: SpellId }
  | { type: "interrupted"; spellId: SpellId }
  | {
      type: "completed";
      spellId: SpellId;
      def: SpellDefinition;
      inputMode: SpellCastInputMode;
    };

/** Movement during windup/channel cancels the cast (auto or manual). */
export type SpellCastInputMode = "manual" | "auto";

export class SpellCastController {
  private activeSpellId: SpellId | null = null;
  private windupElapsedMs = 0;
  private windupDurationMs = 0;
  private channelElapsedMs = 0;
  private channelDurationMs = 0;
  private inChannel = false;
  private castInputMode: SpellCastInputMode = "auto";
  /** Stick deflection when windup/channel started; interrupt only on aim angle change. */
  private moveInterruptBaselineX = 0;
  private moveInterruptBaselineY = 0;
  private readonly cooldownRemainingMs = new Map<SpellId, number>();

  getCastInputMode(): SpellCastInputMode {
    return this.castInputMode;
  }

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
  tryBeginCast(
    spellId: SpellId,
    inputMode: SpellCastInputMode = "auto",
    stickX = 0,
    stickY = 0,
  ): SpellDefinition | "channel" | "windup" | false {
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

    this.castInputMode = inputMode;
    this.moveInterruptBaselineX = stickX;
    this.moveInterruptBaselineY = stickY;
    this.activeSpellId = spellId;
    this.windupElapsedMs = 0;
    this.windupDurationMs = castMs;
    this.channelElapsedMs = 0;
    this.channelDurationMs = hasChannel ? def.channelMs : 0;
    this.inChannel = castMs <= 0 && hasChannel;
    if (this.inChannel) this.armChannelStartCooldown(spellId, def);
    if (castMs > 0) return "windup";
    return "channel";
  }

  updateChannel(
    deltaMs: number,
    stickX: number,
    stickY: number,
  ): ChannelUpdateResult {
    if (!this.activeSpellId) return { type: "idle" };

    if (
      stickDeflectionInterruptsCast(
        stickX,
        stickY,
        this.moveInterruptBaselineX,
        this.moveInterruptBaselineY,
      )
    ) {
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
        const def = spellById(spellId);
        if (def) this.armChannelStartCooldown(spellId, def);
      } else {
        const def = spellById(spellId);
        const inputMode = this.castInputMode;
        this.clearCast();
        if (!def) return { type: "idle" };
        this.cooldownRemainingMs.set(spellId, def.cooldownMs);
        return { type: "completed", spellId, def, inputMode };
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
    const inputMode = this.castInputMode;
    this.clearCast();
    if (!def) return { type: "idle" };
    if (!this.cooldownArmedDuringChannel(spellId, def)) {
      this.cooldownRemainingMs.set(spellId, def.cooldownMs);
    }
    return { type: "completed", spellId, def, inputMode };
  }

  cancelChannel(): void {
    this.clearCast();
  }

  /** Channeled spells arm CD when channeling begins, not when the channel ends. */
  private armChannelStartCooldown(
    _spellId: SpellId,
    def: SpellDefinition,
  ): void {
    if (def.channelMs > 0) {
      this.cooldownRemainingMs.set(_spellId, def.cooldownMs);
    }
  }

  private cooldownArmedDuringChannel(
    _spellId: SpellId,
    def: SpellDefinition,
  ): boolean {
    return def.channelMs > 0;
  }

  private clearCast(): void {
    this.activeSpellId = null;
    this.windupElapsedMs = 0;
    this.windupDurationMs = 0;
    this.channelElapsedMs = 0;
    this.channelDurationMs = 0;
    this.inChannel = false;
    this.castInputMode = "auto";
    this.moveInterruptBaselineX = 0;
    this.moveInterruptBaselineY = 0;
  }
}
