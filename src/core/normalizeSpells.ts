import type { SpellDefinition, SpellMechanicType } from "../content/spells";
import type { ShadowformMechanics } from "../config/shadowformMechanics";
import { ConfigLoadError, requireFiniteNumber } from "./configValidation";

export type SpellsFileInput = { spells: SpellDefinition[] };

const SPELLS_WITHOUT_KNOCKBACK: ReadonlySet<SpellMechanicType> = new Set([
  "heal",
  "ice_wall",
  "buff",
  "blink",
  "channeled",
  "channeled_area",
]);

function spellPath(spellId: string, index: number): string {
  return `spells[${index}].${spellId}`;
}

function requireKnockback(def: SpellDefinition, path: string): number {
  return requireFiniteNumber(def.knockback, `${path}.knockback`);
}

function requireBlastKnockback(def: SpellDefinition, path: string): number {
  return requireFiniteNumber(def.blastKnockback, `${path}.blastKnockback`);
}

function validateSpellMechanicFields(
  def: SpellDefinition,
  path: string,
): void {
  switch (def.mechanicType) {
    case "swing":
    case "tracking_swing":
      requireFiniteNumber(def.swingRangeWu, `${path}.swingRangeWu`);
      requireFiniteNumber(def.swingArcDeg, `${path}.swingArcDeg`);
      return;
    case "cone":
    case "channeled_cone":
      requireFiniteNumber(def.coneRangeWu, `${path}.coneRangeWu`);
      requireFiniteNumber(def.coneArcDeg, `${path}.coneArcDeg`);
      return;
    case "blink":
      requireFiniteNumber(def.blinkDistanceWu, `${path}.blinkDistanceWu`);
      requireFiniteNumber(
        def.blinkResolveBinarySearchIterations,
        `${path}.blinkResolveBinarySearchIterations`,
      );
      requireFiniteNumber(
        def.blinkPartialMoveEpsilonWu,
        `${path}.blinkPartialMoveEpsilonWu`,
      );
      return;
    case "ice_wall":
      requireFiniteNumber(def.iceWallDistanceWu, `${path}.iceWallDistanceWu`);
      requireFiniteNumber(def.iceWallDurationMs, `${path}.iceWallDurationMs`);
      return;
    case "buff":
      requireFiniteNumber(def.shadowformDurationMs, `${path}.shadowformDurationMs`);
      if (def.id === "shadowform") {
        const moveSpeedMult = requireFiniteNumber(
          def.shadowformMoveSpeedMult,
          `${path}.shadowformMoveSpeedMult`,
        );
        const damageTakenMult = requireFiniteNumber(
          def.shadowformDamageTakenMult,
          `${path}.shadowformDamageTakenMult`,
        );
        const aggroRadiusMult = requireFiniteNumber(
          def.shadowformAggroRadiusMult,
          `${path}.shadowformAggroRadiusMult`,
        );
        if (moveSpeedMult <= 0) {
          throw new ConfigLoadError(
            `${path}.shadowformMoveSpeedMult must be > 0`,
          );
        }
        if (damageTakenMult < 0 || damageTakenMult > 1) {
          throw new ConfigLoadError(
            `${path}.shadowformDamageTakenMult must be in [0, 1]`,
          );
        }
        if (aggroRadiusMult < 0 || aggroRadiusMult > 1) {
          throw new ConfigLoadError(
            `${path}.shadowformAggroRadiusMult must be in [0, 1]`,
          );
        }
      }
      return;
    default:
      return;
  }
}

function validateSpellKnockbackFields(
  def: SpellDefinition,
  path: string,
): SpellDefinition {
  validateSpellMechanicFields(def, path);

  if (SPELLS_WITHOUT_KNOCKBACK.has(def.mechanicType)) {
    return def;
  }

  switch (def.mechanicType) {
    case "projectile":
      requireKnockback(def, path);
      return def;
    case "projectile_aoe":
      requireKnockback(def, path);
      requireBlastKnockback(def, path);
      return def;
    case "tracking_projectile":
      requireKnockback(def, path);
      if (def.id === "chain_lightning") {
        requireFiniteNumber(def.chainKnockback, `${path}.chainKnockback`);
        requireFiniteNumber(def.chainHopKnockback, `${path}.chainHopKnockback`);
        requireFiniteNumber(
          def.chainLightningHops,
          `${path}.chainLightningHops`,
        );
        requireFiniteNumber(
          def.chainLightningHopRangeWu,
          `${path}.chainLightningHopRangeWu`,
        );
      }
      return def;
    case "swing":
    case "tracking_swing":
    case "cone":
    case "channeled_cone":
      requireKnockback(def, path);
      return def;
    case "blast":
      requireBlastKnockback(def, path);
      return def;
    case "instant_targeted":
      requireKnockback(def, path);
      if (def.blastRadius != null || (def.burstDamage != null && def.burstDamage > 0)) {
        requireBlastKnockback(def, path);
      }
      return def;
    default:
      throw new ConfigLoadError(
        `Unknown or unsupported spell mechanicType "${def.mechanicType}" at ${path}.mechanicType`,
      );
  }
}

/** Runtime mults for the Shadowform buff spell (validated on the `shadowform` row). */
export function shadowformMechanicsFromCatalog(
  spells: readonly SpellDefinition[],
): ShadowformMechanics {
  const def = spells.find((s) => s.id === "shadowform");
  if (!def) {
    throw new ConfigLoadError("spells.json must include a shadowform spell");
  }
  const moveSpeedMult = def.shadowformMoveSpeedMult;
  const damageTakenMult = def.shadowformDamageTakenMult;
  const aggroRadiusMult = def.shadowformAggroRadiusMult;
  if (
    moveSpeedMult === undefined ||
    damageTakenMult === undefined ||
    aggroRadiusMult === undefined
  ) {
    throw new ConfigLoadError(
      "shadowform spell row missing shadowformMoveSpeedMult, shadowformDamageTakenMult, or shadowformAggroRadiusMult",
    );
  }
  return { moveSpeedMult, damageTakenMult, aggroRadiusMult };
}

export function normalizeSpellCatalog(raw: SpellsFileInput | null | undefined): SpellDefinition[] {
  if (!raw || !Array.isArray(raw.spells) || raw.spells.length === 0) {
    throw new ConfigLoadError("spells.json must include a non-empty spells array");
  }
  return raw.spells.map((row, index) => {
    const path = spellPath(row.id ?? "?", index);
    if (!row.id || typeof row.id !== "string") {
      throw new ConfigLoadError(`Missing string at ${path}.id`);
    }
    if (!row.mechanicType || typeof row.mechanicType !== "string") {
      throw new ConfigLoadError(`Missing string at ${path}.mechanicType`);
    }
    return validateSpellKnockbackFields(row, path);
  });
}