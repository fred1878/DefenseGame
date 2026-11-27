import { playerTuning } from "../../config/player";
import type { SpellDefinition } from "../../content/spells";
import { isStickMoving } from "../../combat/spellInputQueue";
import {
  applyHealAmount,
  applySpellCone,
  strikeSpellCone,
} from "../../combat/SpellEffects";
import {
  advanceChanneledConeTicks,
  CHANNELED_CONE_MAX_TICKS,
  createChanneledConeTickState,
  type ChanneledConeTickState,
} from "../../combat/channeledConeChannel";
import {
  advanceChanneledHealTicks,
  channeledHealMaxTicks,
  channeledHealTickHealAmount,
  createChanneledHealTickState,
  isChanneledHealSpell,
  type ChanneledHealTickState,
} from "../../combat/channeledHealChannel";
import { spellChannelTickMs } from "../../content/spellTargeting";
import { spellById } from "../../content/spells";
import {
  registerSpellGroundAoeTelegraphWorld,
  spellGroundAoePalette,
  spellNeedsGroundAoeTelegraph,
  spawnSpellGroundAoeTelegraph,
  updateSpellGroundAoeTelegraph,
} from "../../combat/SpellGroundAoeTelegraph";
import { spawnGroundZone } from "../../combat/spellGroundZone";
import { COMBAT_FX_TEXTURE } from "../../content/assets";
import { spawnFlamestrikeGroundFlamesLinger } from "../../combat/FlamestrikePvfx";
import {
  playFireWhooshSfx,
  spellPlaysFireWhooshOnChanneledAreaStart,
  spellPlaysFireWhooshOnChanneledConeTick,
  spellPlaysFireWhooshOnChannelLinger,
} from "../../audio/fireWhooshSfx";
import type { DefenseSpellDirectorHost } from "./DefenseSpellDirector";
import {
  syncDefenseHealChannelFx,
  syncDefenseIceCastWindupFx,
} from "./DefenseSpellTelegraphs";

/** Per-cast tick state for channeled cone (damage) and channeled heal spells. */
export class DefenseSpellChannelTicks {
  cone: ChanneledConeTickState = createChanneledConeTickState();
  heal: ChanneledHealTickState = createChanneledHealTickState();

  constructor(
    private readonly host: DefenseSpellDirectorHost,
    private readonly spellDamageMult: (def?: SpellDefinition) => number,
  ) {}

  reset(): void {
    this.cone = createChanneledConeTickState();
    this.heal = createChanneledHealTickState();
  }

  flushCone(def: SpellDefinition): void {
    while (this.cone.ticksDone < CHANNELED_CONE_MAX_TICKS) {
      const fired = advanceChanneledConeTicks(
        this.cone,
        def,
        spellChannelTickMs(def),
      );
      if (fired <= 0) break;
      this.fireCone(def, fired);
    }
  }

  tickConeDuringChannel(def: SpellDefinition, deltaMs: number): void {
    const ticksFired = advanceChanneledConeTicks(this.cone, def, deltaMs);
    if (ticksFired <= 0) return;
    this.fireCone(def, ticksFired);
  }

  flushHeal(def: SpellDefinition): void {
    while (this.heal.ticksDone < channeledHealMaxTicks(def)) {
      const fired = advanceChanneledHealTicks(
        this.heal,
        def,
        spellChannelTickMs(def),
      );
      if (fired <= 0) break;
      this.fireHeal(def, fired);
    }
  }

  tickHealDuringChannel(def: SpellDefinition, deltaMs: number): void {
    const ticksFired = advanceChanneledHealTicks(this.heal, def, deltaMs);
    if (ticksFired <= 0) return;
    this.fireHeal(def, ticksFired);
  }

  private fireHeal(def: SpellDefinition, ticksFired: number): void {
    const amount = channeledHealTickHealAmount(def, ticksFired);
    applyHealAmount(this.host.player.damageable, amount);
    this.heal.healApplied += amount;
  }

  private fireCone(def: SpellDefinition, ticksFired: number): void {
    const host = this.host;
    const mult = this.spellDamageMult(def);
    const px = host.player.sprite.x;
    const py = host.player.sprite.y;
    const angle = host.player.getFacingAngle();
    const targets = host.enemyTargets();
    const firstTickIndex = this.cone.ticksDone - ticksFired;
    for (let i = 0; i < ticksFired; i++) {
      const tickIndex = firstTickIndex + i;
      const isFirstTick = tickIndex === 0;
      if (isFirstTick) {
        applySpellCone(
          host.scene,
          px,
          py,
          angle,
          def,
          targets,
          mult,
          host.enemySpellStatus,
          {
            showFx: true,
            registerWorldDraw: host.maskWorldObject,
          },
        );
        if (spellPlaysFireWhooshOnChanneledConeTick(def, true)) {
          playFireWhooshSfx(host.scene);
        }
      } else {
        strikeSpellCone(
          host.scene,
          px,
          py,
          angle,
          def,
          targets,
          mult,
          host.enemySpellStatus,
        );
      }
    }
    host.filterDeadEnemies();
  }
}

/** Director surface the channel loop drives (kept on `DefenseSpellDirector` for its public API). */
export type DefenseSpellChannelDirector = {
  readonly channelTicks: DefenseSpellChannelTicks;
  syncGroundCastTelegraphs(
    def: SpellDefinition,
    phase: "windup" | "channeling",
    progress: number,
    deltaMs: number,
  ): void;
  startChanneledGroundZone(def: SpellDefinition): void;
  clearGroundCastTelegraphs(): void;
  clearSpellChannelState(): void;
  resolveSpellEffect(def: SpellDefinition): void;
  spawnPostChannelLinger(def: SpellDefinition): void;
  pulseImpactAoeTelegraph(def: SpellDefinition, x: number, y: number): void;
  resumeMovementFromStick(
    dir: { x: number; y: number },
    shouldLockMeleeAimFacing: () => boolean,
  ): void;
};

/** Re-apply stick movement after a cast ends (cast lock released). */
export function resumeDefenseMovementFromStick(
  host: DefenseSpellDirectorHost,
  dir: { x: number; y: number },
  shouldLockMeleeAimFacing: () => boolean,
): void {
  const lockMeleeAim = shouldLockMeleeAimFacing();
  host.player.setVelocityFromStick(
    dir.x,
    dir.y,
    host.wu(playerTuning().moveSpeedWu),
    { lockMeleeAim },
  );
  if (lockMeleeAim) {
    const target = host.targeting.facingTarget("melee", false);
    if (target) host.player.faceToward(target.x, target.y);
  }
}

/** One frame of an active windup / channel: ticks, cast bar, telegraphs, completion. */
export function updateDefenseSpellChanneling(
  host: DefenseSpellDirectorHost,
  director: DefenseSpellChannelDirector,
  delta: number,
  dir: { x: number; y: number },
  shouldLockMeleeAimFacing: () => boolean,
): void {
  const px = host.player.sprite.x;
  const py = host.player.sprite.y;
  if (!host.spellCaster.isChanneling()) return;
  host.player.sprite.setVelocity(0, 0);
  const ticks = director.channelTicks;
  const activeSpellId = host.spellCaster.getActiveSpellId();
  const activeDef = activeSpellId ? spellById(activeSpellId) : undefined;
  if (
    activeDef?.mechanicType === "channeled_cone" &&
    host.spellCaster.getCastPhase() === "channeling"
  ) {
    ticks.tickConeDuringChannel(activeDef, delta);
  }
  if (
    activeDef &&
    isChanneledHealSpell(activeDef) &&
    host.spellCaster.getCastPhase() === "channeling"
  ) {
    ticks.tickHealDuringChannel(activeDef, delta);
  }
  const channel = host.spellCaster.updateChannel(delta, dir.x, dir.y);
  if (channel.type === "windup" || channel.type === "channeling") {
    host.castBar.setVisible(true);
    host.castBar.setPhase(channel.type);
    host.castBar.setWorldPosition(px, py);
    host.castBar.setProgress(channel.progress);
    const chDef = spellById(channel.spellId);
    if (chDef) {
      director.syncGroundCastTelegraphs(
        chDef,
        channel.type,
        channel.progress,
        delta,
      );
      syncDefenseHealChannelFx(host, chDef, channel.type, px, py);
      syncDefenseIceCastWindupFx(host, chDef, channel.type, px, py);
    }
    if (channel.type === "channeling" && chDef && !host.channelAreaStarted) {
      if (chDef.mechanicType !== "channeled_cone") {
        director.startChanneledGroundZone(chDef);
      }
    }
  } else if (channel.type === "interrupted") {
    host.castBar.setVisible(false);
    director.clearGroundCastTelegraphs();
    director.clearSpellChannelState();
    director.resumeMovementFromStick(dir, shouldLockMeleeAimFacing);
  } else if (channel.type === "completed") {
    host.castBar.setVisible(false);
    if (channel.def.mechanicType === "channeled_cone") {
      ticks.flushCone(channel.def);
    }
    if (isChanneledHealSpell(channel.def)) {
      ticks.flushHeal(channel.def);
    }
    const impactCenter = host.spellChannelArea;
    director.resolveSpellEffect(channel.def);
    director.spawnPostChannelLinger(channel.def);
    if (impactCenter && spellNeedsGroundAoeTelegraph(channel.def)) {
      director.pulseImpactAoeTelegraph(
        channel.def,
        impactCenter.x,
        impactCenter.y,
      );
    }
    director.clearGroundCastTelegraphs();
    director.clearSpellChannelState();
    if (channel.inputMode === "manual" && isStickMoving(dir.x, dir.y)) {
      director.resumeMovementFromStick(dir, shouldLockMeleeAimFacing);
    }
  }
}

/** Spawn the damage zone for channeled / channeled-area spells once the channel starts. */
export function startDefenseChanneledGroundZone(
  host: DefenseSpellDirectorHost,
  def: SpellDefinition,
  mult: number,
): void {
  if (host.channelAreaStarted) return;
  const px = host.player.sprite.x;
  const py = host.player.sprite.y;
  const center = host.spellChannelArea ?? { x: px, y: py };
  if (
    def.mechanicType === "channeled_area" ||
    def.mechanicType === "channeled"
  ) {
    host.spellGroundZones.push(
      spawnGroundZone(
        host.scene,
        def,
        center.x,
        center.y,
        mult,
        host.timeNow(),
        {
          durationMs: def.channelMs,
          includeBurst: Boolean(def.burstDamage),
        },
      ),
    );
    host.channelAreaStarted = true;
    if (def.mechanicType === "channeled_area") {
      host.flashNova(center.x, center.y, host.wu(def.blastRadiusWu!), {
        blastTextureKey: COMBAT_FX_TEXTURE.spellFireNova,
      });
      if (spellPlaysFireWhooshOnChanneledAreaStart(def)) {
        playFireWhooshSfx(host.scene);
      }
    }
  }
}

/** Linger damage-over-time zone + telegraph left behind after a channel completes. */
export function spawnDefensePostChannelLinger(
  host: DefenseSpellDirectorHost,
  def: SpellDefinition,
  mult: number,
  clearLingerAoeTelegraph: () => void,
): void {
  if (!def.lingerMs || def.lingerMs <= 0) return;
  const center = host.spellChannelArea ?? {
    x: host.player.sprite.x,
    y: host.player.sprite.y,
  };
  const radiusPx = host.wu(def.blastRadiusWu!);
  const zone = spawnGroundZone(
    host.scene,
    def,
    center.x,
    center.y,
    mult,
    host.timeNow(),
    {
      durationMs: def.lingerMs,
      lingerDot: true,
    },
  );
  if (def.id === "flamestrike") {
    const lingerFx = spawnFlamestrikeGroundFlamesLinger(
      host.scene,
      center.x,
      center.y,
      radiusPx,
      host.maskWorldObject,
    );
    zone.destroyLingerFx = lingerFx.destroy;
    clearLingerAoeTelegraph();
  } else {
    clearLingerAoeTelegraph();
    host.lingerAoeTelegraph = spawnSpellGroundAoeTelegraph(
      host.scene,
      center.x,
      center.y,
      radiusPx,
      spellGroundAoePalette(def),
      1,
      "channel",
    );
    registerSpellGroundAoeTelegraphWorld(
      host.lingerAoeTelegraph,
      host.maskWorldObject,
    );
    updateSpellGroundAoeTelegraph(host.lingerAoeTelegraph, 0, "channel", 1);
    host.flashNova(center.x, center.y, radiusPx, {
      blastTextureKey: COMBAT_FX_TEXTURE.spellFireNova,
    });
  }
  host.spellGroundZones.push(zone);
  if (spellPlaysFireWhooshOnChannelLinger(def)) {
    playFireWhooshSfx(host.scene);
  }
}
