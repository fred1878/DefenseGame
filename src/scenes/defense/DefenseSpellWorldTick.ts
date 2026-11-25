import { applyDamage } from "../../combat/DamageSystem";
import { updateSpellGroundAoeTelegraph } from "../../combat/SpellGroundAoeTelegraph";
import { tickSpellGroundZones } from "../../combat/spellGroundZone";
import type { DefenseSpellDirectorHost } from "./DefenseSpellDirector";

type SpellWorldDirector = {
  spellDamageMult(): number;
  clearLingerAoeTelegraph(): void;
  tickIceWalls(): void;
};

/** Per-frame spell world state: enemy statuses, ground zones, linger telegraph, ice walls. */
export function tickDefenseSpellWorld(
  host: DefenseSpellDirectorHost,
  director: SpellWorldDirector,
  delta: number,
): void {
  host.enemySpellStatus.tick(delta, (enemyId, amount, flavor) => {
    const e = host.targeting.getEnemyById(enemyId);
    if (e?.damageable.alive) applyDamage(e.damageable, amount, flavor);
  });
  for (const e of host.enemies) {
    e.statusSpeedMul = host.enemySpellStatus.moveSpeedMultiplier(e.id);
  }
  host.enemyIceRootFx.tick(host.enemies, host.enemySpellStatus, host.maskWorldObject);
  host.spellGroundZones = tickSpellGroundZones(
    host.scene,
    host.spellGroundZones,
    host.timeNow(),
    delta,
    host.enemyTargets(),
    host.enemySpellStatus,
    director.spellDamageMult(),
  );
  const hasActiveLingerGroundZone = host.spellGroundZones.some(
    (z) => (z.lingerDotDps ?? 0) > 0,
  );
  if (host.lingerAoeTelegraph && !hasActiveLingerGroundZone) {
    director.clearLingerAoeTelegraph();
  } else if (host.lingerAoeTelegraph) {
    updateSpellGroundAoeTelegraph(host.lingerAoeTelegraph, delta, "channel", 1);
  }
  director.tickIceWalls();
}
