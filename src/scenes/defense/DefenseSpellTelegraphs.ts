import type { SpellDefinition } from "../../content/spells";
import { SpellBlizzardChannelFx } from "../../combat/fx/SpellBlizzardChannelFx";
import { SpellHealChannelFx } from "../../combat/fx/SpellHealChannelFx";
import { SpellIceCastWindupFx } from "../../combat/fx/SpellIceCastWindupFx";
import { spellUsesIceCastWindupFx } from "../../content/iceFxSpells";
import {
  destroySpellGroundAoeTelegraph,
  registerSpellGroundAoeTelegraphWorld,
  spellGroundAoePalette,
  spellNeedsGroundAoeTelegraph,
  spawnSpellGroundAoeTelegraph,
  updateSpellGroundAoeTelegraph,
} from "../../combat/fx/SpellGroundAoeTelegraph";
import { spellCastMs } from "../../content/spellTargeting";
import { GroundTargetReticle } from "../../ui/GroundTargetReticle";
import type { DefenseSpellDirectorHost } from "./DefenseSpellDirector";

/** Tear down the windup/channel ground telegraph, blizzard FX and heal channel FX. */
export function clearDefenseGroundCastTelegraphs(
  host: DefenseSpellDirectorHost,
): void {
  destroySpellGroundAoeTelegraph(host.groundAoeTelegraph);
  host.groundAoeTelegraph = null;
  host.blizzardChannelFx?.destroy();
  host.blizzardChannelFx = null;
  if (host.healChannelFx) {
    const healFx = host.healChannelFx;
    host.healChannelFx = null;
    healFx.fadeOut();
  }
  host.iceCastWindupFx?.stop();
  host.iceCastWindupFx = null;
}

export function clearDefenseLingerAoeTelegraph(
  host: DefenseSpellDirectorHost,
): void {
  destroySpellGroundAoeTelegraph(host.lingerAoeTelegraph);
  host.lingerAoeTelegraph = null;
}

/** Reticle + ground AoE telegraph (and blizzard FX) while a ground spell winds up / channels. */
export function syncDefenseGroundCastTelegraphs(
  host: DefenseSpellDirectorHost,
  def: SpellDefinition,
  phase: "windup" | "channeling",
  progress: number,
  deltaMs: number,
  defaultGroundTarget: (def: SpellDefinition) => { x: number; y: number },
): void {
  if (!spellNeedsGroundAoeTelegraph(def)) return;
  const center =
    host.spellChannelArea ?? host.groundAim ?? defaultGroundTarget(def);
  const radiusWu = host.wu(def.blastRadiusWu!);
  const reticleStyle = GroundTargetReticle.styleForSpellId(def.id);
  if (phase === "windup") {
    host.groundReticle.showAt(center.x, center.y, radiusWu, reticleStyle);
  } else {
    host.groundReticle.hide();
  }
  const telegraphMode = phase === "windup" ? "windup" : "channel";
  if (!host.groundAoeTelegraph) {
    host.groundAoeTelegraph = spawnSpellGroundAoeTelegraph(
      host.scene,
      center.x,
      center.y,
      radiusWu,
      spellGroundAoePalette(def),
      spellCastMs(def),
      telegraphMode,
    );
    registerSpellGroundAoeTelegraphWorld(
      host.groundAoeTelegraph,
      host.maskWorldObject,
    );
  } else {
    host.groundAoeTelegraph.zoneX = center.x;
    host.groundAoeTelegraph.zoneY = center.y;
    host.groundAoeTelegraph.zoneRadius = radiusWu;
  }
  updateSpellGroundAoeTelegraph(
    host.groundAoeTelegraph,
    deltaMs,
    telegraphMode,
    progress,
  );
  if (def.id === "blizzard" && phase === "channeling") {
    if (!host.blizzardChannelFx) {
      host.blizzardChannelFx = new SpellBlizzardChannelFx(host.scene);
      host.blizzardChannelFx.start(
        center.x,
        center.y,
        radiusWu,
        SpellBlizzardChannelFx.defaultTextureKey(),
      );
    }
  } else if (host.blizzardChannelFx) {
    host.blizzardChannelFx.stop();
  }
}

/** Start / follow / fade the heal channel FX around the caster. */
export function syncDefenseHealChannelFx(
  host: DefenseSpellDirectorHost,
  def: SpellDefinition,
  phase: "windup" | "channeling",
  px: number,
  py: number,
): void {
  if (def.id === "heal" && phase === "channeling") {
    if (!host.healChannelFx) {
      host.healChannelFx = new SpellHealChannelFx(host.scene);
      host.healChannelFx.start(px, py, host.maskWorldObject);
    } else {
      host.healChannelFx.follow(px, py);
    }
    return;
  }
  if (host.healChannelFx) {
    const healFx = host.healChannelFx;
    host.healChannelFx = null;
    healFx.fadeOut();
  }
}

/** Short impact flash of the ground AoE ring when a channeled ground spell lands. */
export function pulseDefenseImpactAoeTelegraph(
  host: DefenseSpellDirectorHost,
  def: SpellDefinition,
  x: number,
  y: number,
): void {
  const radiusWu = host.wu(def.blastRadiusWu!);
  const impact = spawnSpellGroundAoeTelegraph(
    host.scene,
    x,
    y,
    radiusWu,
    spellGroundAoePalette(def),
    1,
    "impact",
  );
  registerSpellGroundAoeTelegraphWorld(impact, host.maskWorldObject);
  updateSpellGroundAoeTelegraph(impact, 0, "impact", 1);
  host.delayedCall(360, () => destroySpellGroundAoeTelegraph(impact));
}

/** Ice VFX 2 Start on caster during frost spell windup. */
export function syncDefenseIceCastWindupFx(
  host: DefenseSpellDirectorHost,
  def: SpellDefinition,
  phase: "windup" | "channeling",
  px: number,
  py: number,
): void {
  if (!spellUsesIceCastWindupFx(def)) {
    if (host.iceCastWindupFx) {
      host.iceCastWindupFx.stop();
      host.iceCastWindupFx = null;
    }
    return;
  }
  if (phase === "windup") {
    if (!host.iceCastWindupFx) {
      host.iceCastWindupFx = new SpellIceCastWindupFx(host.scene);
      host.iceCastWindupFx.start(
        px,
        py,
        spellCastMs(def),
        host.maskWorldObject,
      );
    } else {
      host.iceCastWindupFx.follow(px, py);
    }
    return;
  }
  host.iceCastWindupFx?.stop();
  host.iceCastWindupFx = null;
}
