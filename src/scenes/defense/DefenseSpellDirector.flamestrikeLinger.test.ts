import { describe, expect, it, vi } from "vitest";
import { SpellCastController } from "../../combat/rules/SpellCastController";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";
import { PVFX_ANIM, PVFX_FX_ASSETS } from "../../content/combatPvfxAssets";
import { spellById } from "../../content/spells";
import { spellCastMs } from "../../content/spellTargeting";
import { asScene, fakeScene } from "../../test/fakeScene";

function flamestrikeHost(
  spellCaster: SpellCastController,
): DefenseSpellDirectorHost {
  const castBar = {
    setVisible: vi.fn(),
    setPhase: vi.fn(),
    setWorldPosition: vi.fn(),
    setProgress: vi.fn(),
  };
  const player = {
    sprite: { x: 10, y: 20, setVelocity: vi.fn() },
    getFacingAngle: () => 0,
    faceToward: vi.fn(),
    setVelocityFromStick: vi.fn(),
    damageable: { hp: 100, maxHp: 100, alive: true },
  };
  const scene = asScene(
    fakeScene({
      textures: PVFX_FX_ASSETS.map((a) => a.key),
      anims: Object.values(PVFX_ANIM),
    }),
  );
  return {
    scene,
    save: { buildings: {} } as unknown as DefenseSpellDirectorHost["save"],
    player: player as unknown as DefenseSpellDirectorHost["player"],
    enemies: [],
    projectiles: [],
    targeting: {
      facingTarget: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["targeting"],
    spellCaster,
    spellInputQueue: {} as DefenseSpellDirectorHost["spellInputQueue"],
    enemySpellStatus: {} as DefenseSpellDirectorHost["enemySpellStatus"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: castBar as unknown as DefenseSpellDirectorHost["castBar"],
    groundReticle: {
      hide: vi.fn(),
      showAt: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["groundReticle"],
    obstacleGroup: {} as Phaser.Physics.Arcade.StaticGroup,
    spellChannelArea: { x: 120, y: 140 },
    spellGroundZones: [],
    pendingGroundCast: null,
    groundAim: null,
    groundAoeTelegraph: null,
    lingerAoeTelegraph: null,
    blizzardChannelFx: null,
    healChannelFx: null,
    channelAreaStarted: false,
    shadowformEndsAt: 0,
    iceWallExpires: [],
    wu: (n: number) => n,
    enemyTargets: () => [],
    resolveStrikeMode: () => "ranged" as const,
    flashNova: vi.fn(),
    nextProjectileId: () => "0",
    filterDeadEnemies: vi.fn(),
    timeNow: () => 1000,
    delayedCall: vi.fn(),
    maskWorldObject: vi.fn(),
  } as unknown as DefenseSpellDirectorHost;
}

describe("DefenseSpellDirector flamestrike", () => {
  it("frees the player after cast while spawning an independent ground linger zone", () => {
    const def = spellById("flamestrike");
    expect(def).toBeDefined();
    if (!def) return;
    expect(def.channelMs).toBe(0);
    expect(def.lingerMs).toBeGreaterThan(0);

    const spellCaster = new SpellCastController();
    spellCaster.tryBeginCast("flamestrike");
    const host = flamestrikeHost(spellCaster);

    directorFinishCast(host, spellCastMs(def) + 1);

    expect(spellCaster.isChanneling()).toBe(false);
    expect(host.castBar.setVisible).toHaveBeenCalledWith(false);
    expect(host.lingerAoeTelegraph).toBeNull();
    expect(host.spellGroundZones).toHaveLength(1);
    expect(host.spellGroundZones[0]?.lingerDotDps).toBeGreaterThan(0);
    expect(host.spellGroundZones[0]?.destroyLingerFx).toBeTypeOf("function");
  });
});

function directorFinishCast(
  host: DefenseSpellDirectorHost,
  windupMs: number,
): void {
  const director = new DefenseSpellDirector(host);
  director.updateChanneling(windupMs, { x: 0, y: 0 }, () => false);
}
