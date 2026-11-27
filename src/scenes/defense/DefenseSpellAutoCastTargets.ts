import { tuning } from "../../tuning/gameTuning";
import { pickAutoCastCombatEnemy } from "../../combat/rules/spellAutoCastCombatEnemy";
import {
  AUTO_CAST_GROUND_ENEMY_SEARCH_RANGE,
  resolveAutoCastGroundAim,
} from "../../combat/rules/spellGroundAim";
import { playerTuning } from "../../config/player";
import {
  spellAutoCastUsesRangedEnemyPick,
  spellTargetMode,
} from "../../content/spellTargeting";
import { requireSpellNumber, type SpellDefinition } from "../../content/spells";
import type { DefenseSpellDirectorHost } from "./DefenseSpellDirector";

/** Auto-cast target picking for the spell director (enemy and ground aim). */

type AutoCastHost = Pick<
  DefenseSpellDirectorHost,
  "enemies" | "player" | "targeting" | "wu" | "resolveStrikeMode"
>;

export type GroundAimEnemy = {
  id: string;
  x: number;
  y: number;
  radius: number;
  alive: boolean;
};

export function defenseGroundAimEnemies(host: AutoCastHost): GroundAimEnemy[] {
  const radiusFrac = tuning("spellInput").groundAimEnemyRadiusFrac;
  return host.enemies.map((e) => ({
    id: e.id,
    x: e.sprite.x,
    y: e.sprite.y,
    radius: e.sprite.displayWidth * radiusFrac,
    alive: e.damageable.alive,
  }));
}

/** Ground point an auto-cast (or short-tapped) ground spell lands on. */
export function defenseAutoCastGroundTarget(
  host: AutoCastHost,
  def: SpellDefinition,
): { x: number; y: number } {
  const px = host.player.sprite.x;
  const py = host.player.sprite.y;
  const maxR = host.wu(requireSpellNumber(def, "groundTargetMaxRangeWu"));
  const strike = host.resolveStrikeMode(host.player.mode === "auto");
  return resolveAutoCastGroundAim(
    px,
    py,
    host.player.getFacingAngle(),
    host.targeting.focusEnemyId,
    defenseGroundAimEnemies(host),
    strike,
    host.wu(playerTuning().autoAttackMeleeRange),
    host.wu(playerTuning().autoAttackRangedRange),
    maxR,
  );
}

/** Enemy an auto-cast spell should aim at, or null when none is in range. */
export function defenseAutoCastCombatTarget(
  host: AutoCastHost,
  def: SpellDefinition,
): { id: string; x: number; y: number } | null {
  const px = host.player.sprite.x;
  const py = host.player.sprite.y;
  const searchR =
    spellTargetMode(def) === "ground"
      ? AUTO_CAST_GROUND_ENEMY_SEARCH_RANGE
      : host.wu(
          // Enemy-acquisition radius for non-ground casts — not a cast range.
          // Ground/instant rows author their own; melee/cone use the ranged band.
          def.groundTargetMaxRangeWu ?? playerTuning().autoAttackRangedRange,
        );
  const strike = spellAutoCastUsesRangedEnemyPick(def)
    ? "ranged"
    : host.resolveStrikeMode(host.player.mode === "auto");
  return (
    pickAutoCastCombatEnemy(
      px,
      py,
      host.targeting.focusEnemyId,
      defenseGroundAimEnemies(host),
      strike,
      host.wu(playerTuning().autoAttackMeleeRange),
      host.wu(playerTuning().autoAttackRangedRange),
      searchR,
    ) ?? null
  );
}
