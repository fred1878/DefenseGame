import { describe, expect, it, vi } from "vitest";
import { SpellCastController } from "../../combat/SpellCastController";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";

function lingerChannelHost(
  spellCaster: SpellCastController,
): DefenseSpellDirectorHost {
  const gfx = {
    setDepth: vi.fn(),
    clear: vi.fn(),
    lineStyle: vi.fn(),
    fillStyle: vi.fn(),
    strokeCircle: vi.fn(),
    fillCircle: vi.fn(),
    destroy: vi.fn(),
  };
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
  };
  return {
    scene: {
      registry: { get: () => undefined },
      add: { graphics: () => gfx },
      cache: { audio: { exists: () => false } },
      sound: { play: vi.fn() },
    } as unknown as Phaser.Scene,
    save: { buildings: {} } as unknown as DefenseSpellDirectorHost["save"],
    player: player as unknown as DefenseSpellDirectorHost["player"],
    enemies: [],
    projectiles: [],
    targeting: { facingTarget: vi.fn() } as unknown as DefenseSpellDirectorHost["targeting"],
    spellCaster,
    spellInputQueue: {} as DefenseSpellDirectorHost["spellInputQueue"],
    enemySpellStatus: {} as DefenseSpellDirectorHost["enemySpellStatus"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: castBar as unknown as DefenseSpellDirectorHost["castBar"],
    groundReticle: { hide: vi.fn(), showAt: vi.fn() } as unknown as DefenseSpellDirectorHost["groundReticle"],
    obstacleGroup: {} as Phaser.Physics.Arcade.StaticGroup,
    spellChannelArea: { x: 120, y: 140 },
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

describe("DefenseSpellDirector flamestrike linger channel", () => {
  it("keeps cast bar up and spawns linger when effect channel completes", () => {
    const spellCaster = new SpellCastController();
    spellCaster.tryBeginCast("flamestrike");
    const host = lingerChannelHost(spellCaster);
    const director = new DefenseSpellDirector(host);

    director.updateChanneling(650, { x: 0, y: 0 }, () => false);
    director.updateChanneling(3500, { x: 0, y: 0 }, () => false);
    expect(host.lingerAoeTelegraph).not.toBeNull();
    expect(host.castBar.setVisible).toHaveBeenCalledWith(true);
    expect(host.castBar.setPhase).toHaveBeenCalledWith("channeling");
    expect(spellCaster.isChanneling()).toBe(true);

    director.updateChanneling(3000, { x: 0, y: 0 }, () => false);
    expect(spellCaster.isChanneling()).toBe(false);
    expect(host.castBar.setVisible).toHaveBeenCalledWith(false);
  });
});