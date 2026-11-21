import { describe, expect, it, vi, afterEach } from "vitest";
import { SpellCastController } from "../../combat/SpellCastController";
import * as SpellEffects from "../../combat/SpellEffects";
import * as spellOnHitEffects from "../../combat/spellOnHitEffects";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";
import type { SpellDefinition } from "../../content/spells";
import { setSpellCatalog } from "../../content/spells";
import bundledSpells from "../../../public/data/spells.json";

const coneOfFire = (): SpellDefinition => {
  const row = bundledSpells.spells.find((s) => s.id === "cone_of_fire");
  if (!row) throw new Error("missing cone_of_fire");
  return row as SpellDefinition;
};

function makeHost(spellCaster: SpellCastController): DefenseSpellDirectorHost {
  const gfx = {
    setDepth: vi.fn(),
    fillStyle: vi.fn(),
    lineStyle: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fillPath: vi.fn(),
    strokePath: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    scene: {
      registry: { get: () => 1 },
      add: { graphics: () => gfx },
      time: { delayedCall: vi.fn() },
      tweens: { add: vi.fn() },
      cache: { audio: { exists: () => false } },
      sound: { play: vi.fn() },
    } as unknown as Phaser.Scene,
    save: { buildings: {} } as unknown as DefenseSpellDirectorHost["save"],
    player: {
      sprite: { x: 0, y: 0, setVelocity: vi.fn() },
      getFacingAngle: () => 0,
      setVelocityFromStick: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["player"],
    enemies: [],
    projectiles: [],
    targeting: { facingTarget: vi.fn() } as unknown as DefenseSpellDirectorHost["targeting"],
    spellCaster,
    spellInputQueue: {} as DefenseSpellDirectorHost["spellInputQueue"],
    enemySpellStatus: {
      applyDot: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["enemySpellStatus"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: {
      setVisible: vi.fn(),
      setPhase: vi.fn(),
      setWorldPosition: vi.fn(),
      setProgress: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["castBar"],
    groundReticle: { showAt: vi.fn(), hide: vi.fn() },
    obstacleGroup: {} as Phaser.Physics.Arcade.StaticGroup,
    obstacleBlockers: [],
    spellChannelArea: null,
    spellGroundZones: [],
    pendingGroundCast: null,
    groundAim: null,
    groundAoeTelegraph: null,
    lingerAoeTelegraph: null,
    blizzardChannelFx: null,
    channelAreaStarted: false,
    shadowformEndsAt: 0,
    iceWallExpires: [],
    wu: (n: number) => n,
    enemyTargets: () => [
      {
        id: "e1",
        x: 80,
        y: 0,
        radius: 16,
        damageable: { alive: true, hp: 50, maxHp: 50 },
        enemy: {
          sprite: { x: 80, y: 0 },
          weight: 1,
        } as never,
      },
    ],
    resolveStrikeMode: () => "ranged" as const,
    flashNova: vi.fn(),
    nextProjectileId: () => "0",
    filterDeadEnemies: vi.fn(),
    timeNow: () => 0,
    delayedCall: vi.fn(),
    maskWorldObject: vi.fn(),
  } as unknown as DefenseSpellDirectorHost;
}

describe("DefenseSpellDirector channeled cone", () => {
  afterEach(() => {
    setSpellCatalog(bundledSpells.spells as SpellDefinition[]);
    vi.restoreAllMocks();
  });

  it("applies three cone ticks with onHit during a full channel", () => {
    setSpellCatalog(bundledSpells.spells as SpellDefinition[]);
    const spellCaster = new SpellCastController();
    const host = makeHost(spellCaster);
    const director = new DefenseSpellDirector(host);
    const strikeSpy = vi.spyOn(SpellEffects, "strikeSpellCone");
    const coneSpy = vi.spyOn(SpellEffects, "applySpellCone");
    const onHitSpy = vi.spyOn(spellOnHitEffects, "applySpellOnHitEffects");

    spellCaster.tryBeginCast("cone_of_fire");
    director.updateChanneling(250, { x: 0, y: 0 }, () => false);
    director.updateChanneling(250, { x: 0, y: 0 }, () => false);
    director.updateChanneling(250, { x: 0, y: 0 }, () => false);

    expect(coneSpy).toHaveBeenCalledTimes(1);
    expect(strikeSpy.mock.calls.length + coneSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(onHitSpy).toHaveBeenCalledTimes(3);
    const def = coneOfFire();
    expect(onHitSpy.mock.calls[0]?.[2]).toEqual(def.onHit);

    director.updateChanneling(1, { x: 0, y: 0 }, () => false);
    expect(spellCaster.isChanneling()).toBe(false);
    strikeSpy.mockClear();
    coneSpy.mockClear();
  });
});