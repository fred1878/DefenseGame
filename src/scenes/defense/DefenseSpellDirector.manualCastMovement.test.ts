import { describe, expect, it, vi } from "vitest";
import { spellById } from "../../content/spells";
import { spellCastMs } from "../../content/spellTargeting";
import { SpellCastController } from "../../combat/SpellCastController";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";

function minimalHost(
  spellCaster: SpellCastController,
): DefenseSpellDirectorHost {
  return {
    scene: { registry: { get: () => undefined } } as unknown as Phaser.Scene,
    save: {
      buildings: {},
      player: { moveSpeedWu: 100 },
    } as unknown as DefenseSpellDirectorHost["save"],
    player: {
      sprite: { x: 0, y: 0, setVelocity: vi.fn() },
      setVelocityFromStick: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["player"],
    enemies: [],
    projectiles: [],
    targeting: {
      facingTarget: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["targeting"],
    spellCaster,
    spellInputQueue: {} as DefenseSpellDirectorHost["spellInputQueue"],
    enemySpellStatus: {} as DefenseSpellDirectorHost["enemySpellStatus"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: {
      setVisible: vi.fn(),
      setPhase: vi.fn(),
      setWorldPosition: vi.fn(),
      setProgress: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["castBar"],
    groundReticle: { showAt: vi.fn(), hide: vi.fn() },
    obstacleGroup: {} as Phaser.Physics.Arcade.StaticGroup,
    spellChannelArea: null,
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
    timeNow: () => 0,
    delayedCall: vi.fn(),
    maskWorldObject: vi.fn(),
  } as unknown as DefenseSpellDirectorHost;
}

describe("DefenseSpellDirector manual cast movement", () => {
  it("stops on windup begin and completes when the stick stays still", () => {
    const spellCaster = new SpellCastController();
    const host = minimalHost(spellCaster);
    const director = new DefenseSpellDirector(host);
    const resolveSpy = vi
      .spyOn(
        director as unknown as { resolveSpellEffect: () => void },
        "resolveSpellEffect",
      )
      .mockImplementation(() => {});

    director.beginSpellCast("fire_bolt", "manual");
    expect(host.player.sprite.setVelocity).toHaveBeenCalledWith(0, 0);

    const windupMs = spellCastMs(spellById("fire_bolt")!);
    let elapsed = 0;
    while (spellCaster.isChanneling() && elapsed < windupMs) {
      director.updateChanneling(16, { x: 0, y: 0 }, () => false);
      elapsed += 16;
    }
    director.updateChanneling(
      windupMs - elapsed + 1,
      { x: 0, y: 0 },
      () => false,
    );
    expect(spellCaster.isChanneling()).toBe(false);
    expect(host.player.setVelocityFromStick).not.toHaveBeenCalled();
    resolveSpy.mockRestore();
  });

  it("suppresses drift when manual cast begins with stick already deflected", () => {
    const spellCaster = new SpellCastController();
    const host = minimalHost(spellCaster);
    const director = new DefenseSpellDirector(host);

    director.beginSpellCast("fire_bolt", "manual", 0.55, 0);
    expect(host.player.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
    expect(spellCaster.updateChannel(16, 0.55, 0)).toMatchObject({
      type: "windup",
    });
    director.updateChanneling(16, { x: 0.55, y: 0 }, () => false);
    expect(spellCaster.isChanneling()).toBe(true);
    expect(host.player.setVelocityFromStick).not.toHaveBeenCalled();
  });

  it("cancels manual windup when stick moves and resumes movement", () => {
    const spellCaster = new SpellCastController();
    const host = minimalHost(spellCaster);
    const director = new DefenseSpellDirector(host);

    director.beginSpellCast("fire_bolt", "manual");
    director.updateChanneling(16, { x: 0, y: 0 }, () => false);
    director.updateChanneling(8, { x: 0.5, y: 0 }, () => false);

    expect(spellCaster.isChanneling()).toBe(false);
    expect(host.player.setVelocityFromStick).toHaveBeenCalled();
  });

  it("does not resume movement on auto cast completion", () => {
    const spellCaster = new SpellCastController();
    const host = minimalHost(spellCaster);
    const director = new DefenseSpellDirector(host);
    vi.spyOn(
      director as unknown as { resolveSpellEffect: () => void },
      "resolveSpellEffect",
    ).mockImplementation(() => {});

    spellCaster.tryBeginCast("fire_bolt", "auto");
    let ticks = 0;
    while (spellCaster.isChanneling() && ticks < 500) {
      director.updateChanneling(16, { x: 0, y: 0 }, () => false);
      ticks += 1;
    }
    expect(host.player.setVelocityFromStick).not.toHaveBeenCalled();
  });
});
