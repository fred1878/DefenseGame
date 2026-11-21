import type Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnemySpellStatusMap } from "../../combat/enemySpellStatus";
import { ConfigLoadError } from "../../core/configValidation";
import bundledSpells from "../../../public/data/spells.json";
import { setSpellCatalog, type SpellDefinition } from "../../content/spells";
import type { PlayerProjectile } from "../../entities/Projectile";
import type { Player } from "../../entities/Player";
import { tickDefenseProjectiles, type DefenseProjectileTickHost } from "./DefenseProjectileTick";

function projectileWithSpell(spellId: string): PlayerProjectile {
  return {
    id: "p0",
    spellId,
    sprite: {
      active: true,
      x: 32,
      y: 0,
      texture: { key: "fx_spell_fire_bolt" },
      destroy: vi.fn(),
      setRotation: vi.fn(),
      body: { velocity: { x: 400, y: 0 } },
    } as unknown as Phaser.Physics.Arcade.Sprite,
    damage: 12,
    damageFlavor: "default",
    maxTravel: 200,
    traveled: 0,
    prevX: 0,
    prevY: 0,
  };
}

function tickHost(projectiles: PlayerProjectile[]): DefenseProjectileTickHost {
  const scene = { registry: {} } as unknown as Phaser.Scene;
  return {
    scene,
    registry: scene.registry,
    player: { sprite: { x: 0, y: 0 } } as unknown as Player,
    playerInvulnMs: 0,
    projectiles,
    enemyProjectiles: [],
    enemyTargets: () => [],
    spellDamageMult: () => 1,
    wu: (n: number) => n,
    findEnemy: () => undefined,
    enemySpellStatus: new EnemySpellStatusMap(),
    flashNova: vi.fn(),
  };
}

describe("tickDefenseProjectiles spell knockback", () => {
  afterEach(() => {
    setSpellCatalog(bundledSpells.spells as SpellDefinition[]);
  });

  it("throws when a spell projectile has no knockback in catalog", () => {
    const broken: SpellDefinition = {
      id: "broken_bolt",
      name: "Broken",
      shortLabel: "B",
      mechanicType: "projectile",
      castableInDefense: true,
      implementationPhase: 1,
      cooldownMs: 0,
      channelMs: 0,
      iconFile: "x.png",
    };
    setSpellCatalog([broken]);
    expect(() =>
      tickDefenseProjectiles(tickHost([projectileWithSpell("broken_bolt")]), 16),
    ).toThrow(ConfigLoadError);
  });
});