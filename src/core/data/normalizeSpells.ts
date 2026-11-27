import { DAMAGE_FLAVORS } from "../../combat/rules/DamageSystem";
import type { SpellDefinition, SpellMechanicType } from "../../content/spells";
import type { ShadowformMechanics } from "../../config/shadowformMechanics";
import { ConfigLoadError, requireFiniteNumber } from "./configValidation";

export type SpellsFileInput = { spells: SpellDefinition[] };

/** Boot-validated spell file and row identifiers (see `DATA_FIELDS.md`). */
export const SPELLS_FILE_BOOT_KEYS = ["spells"] as const;
export const SPELL_ROW_BOOT_STRING_FIELDS = ["id", "mechanicType"] as const;

/** Per-`mechanicType` numeric fields required at boot (before knockback rules). */
export const SPELL_MECHANIC_TYPE_BOOT_FIELDS: Record<
  string,
  readonly string[]
> = {
  projectile: ["baseDamage"],
  projectile_aoe: ["baseDamage"],
  tracking_projectile: ["baseDamage"],
  swing: ["baseDamage", "swingRangeWu", "swingArcDeg", "swingFxSizePx"],
  tracking_swing: [
    "baseDamage",
    "swingRangeWu",
    "swingArcDeg",
    "swingFxSizePx",
  ],
  cone: ["baseDamage", "coneRangeWu", "coneArcDeg"],
  channeled_cone: ["baseDamage", "coneRangeWu", "coneArcDeg"],
  blast: ["baseDamage"],
  channeled: ["baseDamage"],
  instant_targeted: ["baseDamage"],
  heal: ["healAmount"],
  blink: [
    "blinkDistanceWu",
    "blinkResolveBinarySearchIterations",
    "blinkPartialMoveEpsilonWu",
  ],
  ice_wall: ["iceWallDistanceWu", "iceWallDurationMs"],
  buff: ["shadowformDurationMs"],
};

/** Extra boot field for `instant_targeted` rows with a `blastRadiusWu` splash. */
export const SPELL_SPLASH_BOOT_FIELDS = ["burstBlastDamageScale"] as const;

/** Mechanics whose rows must author `baseDamage` (no hidden code default). */
const DAMAGING_MECHANICS: ReadonlySet<SpellMechanicType> = new Set([
  "projectile",
  "projectile_aoe",
  "tracking_projectile",
  "swing",
  "tracking_swing",
  "cone",
  "channeled_cone",
  "blast",
  "channeled",
  "instant_targeted",
]);

/** Extra boot fields when `id` is `shadowform`. */
export const SPELL_SHADOWFORM_BOOT_FIELDS = [
  "shadowformMoveSpeedMult",
  "shadowformDamageTakenMult",
  "shadowformAggroRadiusMult",
] as const;

/** Knockback-related fields validated by mechanic (any spell row may use a subset). */
export const SPELL_KNOCKBACK_BOOT_FIELDS = [
  "knockback",
  "blastKnockback",
  "chainKnockback",
  "chainHopKnockback",
  "chainLightningHops",
  "chainLightningHopRangeWu",
] as const;

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

const DAMAGE_FLAVOR_SET = new Set<string>(DAMAGE_FLAVORS);

function validateSpellDamageFlavor(def: SpellDefinition, path: string): void {
  if (def.damageFlavor === undefined) return;
  if (!DAMAGE_FLAVOR_SET.has(def.damageFlavor)) {
    throw new ConfigLoadError(
      `${path}.damageFlavor must be one of ${DAMAGE_FLAVORS.join(", ")}`,
    );
  }
}

function requireKnockback(def: SpellDefinition, path: string): number {
  return requireFiniteNumber(def.knockbackWu, `${path}.knockbackWu`);
}

function requireBlastKnockback(def: SpellDefinition, path: string): number {
  return requireFiniteNumber(def.blastKnockbackWu, `${path}.blastKnockbackWu`);
}

function requireBlastRadiusWu(def: SpellDefinition, path: string): number {
  return requireFiniteNumber(def.blastRadiusWu, `${path}.blastRadiusWu`);
}

function validateSpellAmounts(def: SpellDefinition, path: string): void {
  if (DAMAGING_MECHANICS.has(def.mechanicType)) {
    requireFiniteNumber(def.baseDamage, `${path}.baseDamage`);
  }
  if (def.mechanicType === "heal") {
    requireFiniteNumber(def.healAmount, `${path}.healAmount`);
  }
  if (
    def.mechanicType === "instant_targeted" &&
    def.blastRadiusWu !== undefined
  ) {
    requireFiniteNumber(
      def.burstBlastDamageScale,
      `${path}.burstBlastDamageScale`,
    );
  }
}

function validateSpellMechanicFields(def: SpellDefinition, path: string): void {
  validateSpellAmounts(def, path);
  switch (def.mechanicType) {
    case "swing":
    case "tracking_swing":
      requireFiniteNumber(def.swingRangeWu, `${path}.swingRangeWu`);
      requireFiniteNumber(def.swingArcDeg, `${path}.swingArcDeg`);
      requireFiniteNumber(def.swingFxSizePx, `${path}.swingFxSizePx`);
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
    case "channeled_area":
      requireBlastRadiusWu(def, path);
      return;
    case "ice_wall":
      requireFiniteNumber(def.iceWallDistanceWu, `${path}.iceWallDistanceWu`);
      requireFiniteNumber(def.iceWallDurationMs, `${path}.iceWallDurationMs`);
      return;
    case "buff":
      requireFiniteNumber(
        def.shadowformDurationMs,
        `${path}.shadowformDurationMs`,
      );
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
      requireBlastRadiusWu(def, path);
      return def;
    case "tracking_projectile":
      requireKnockback(def, path);
      if (def.id === "chain_lightning") {
        requireFiniteNumber(def.chainKnockbackWu, `${path}.chainKnockbackWu`);
        requireFiniteNumber(
          def.chainHopKnockbackWu,
          `${path}.chainHopKnockbackWu`,
        );
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
      requireBlastRadiusWu(def, path);
      return def;
    case "channeled_area":
      requireBlastRadiusWu(def, path);
      return def;
    case "instant_targeted":
      requireKnockback(def, path);
      if (
        def.blastRadiusWu != null ||
        (def.burstDamage != null && def.burstDamage > 0)
      ) {
        requireBlastKnockback(def, path);
        if (def.blastRadiusWu != null) {
          requireBlastRadiusWu(def, path);
        }
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

export function normalizeSpellCatalog(
  raw: SpellsFileInput | null | undefined,
): SpellDefinition[] {
  if (!raw || !Array.isArray(raw.spells) || raw.spells.length === 0) {
    throw new ConfigLoadError(
      "spells.json must include a non-empty spells array",
    );
  }
  return raw.spells.map((row, index) => {
    const path = spellPath(row.id ?? "?", index);
    if (!row.id || typeof row.id !== "string") {
      throw new ConfigLoadError(`Missing string at ${path}.id`);
    }
    if (!row.mechanicType || typeof row.mechanicType !== "string") {
      throw new ConfigLoadError(`Missing string at ${path}.mechanicType`);
    }
    validateSpellDamageFlavor(row, path);
    return validateSpellKnockbackFields(row, path);
  });
}
