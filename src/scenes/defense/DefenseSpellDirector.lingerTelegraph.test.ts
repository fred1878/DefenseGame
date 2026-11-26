import { describe, expect, it, vi } from "vitest";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";
import * as FlamestrikePvfx from "../../combat/FlamestrikePvfx";
import * as SpellGroundAoeTelegraph from "../../combat/SpellGroundAoeTelegraph";
import { PVFX_ANIM, PVFX_FX_ASSETS } from "../../content/combatPvfxAssets";
import { spellById } from "../../content/spells";
import { asScene, fakeScene } from "../../test/fakeScene";

function spellDirectorTestHost(
  overrides: Partial<DefenseSpellDirectorHost> = {},
): DefenseSpellDirectorHost {
  const spellGroundZones: DefenseSpellDirectorHost["spellGroundZones"] = [];
  const player = {
    sprite: { x: 50, y: 60 },
  };
  let lingerAoeTelegraph: DefenseSpellDirectorHost["lingerAoeTelegraph"] = null;
  const maskWorldObject = vi.fn();
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
    targeting: {} as DefenseSpellDirectorHost["targeting"],
    spellCaster: {} as DefenseSpellDirectorHost["spellCaster"],
    spellInputQueue: {} as DefenseSpellDirectorHost["spellInputQueue"],
    enemySpellStatus: {} as DefenseSpellDirectorHost["enemySpellStatus"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: {} as DefenseSpellDirectorHost["castBar"],
    groundReticle: {
      hide: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["groundReticle"],
    obstacleGroup: {} as Phaser.Physics.Arcade.StaticGroup,
    spellChannelArea: { x: 120, y: 140 },
    get spellGroundZones() {
      return spellGroundZones;
    },
    set spellGroundZones(v) {
      spellGroundZones.length = 0;
      spellGroundZones.push(...v);
    },
    pendingGroundCast: null,
    groundAim: null,
    groundAoeTelegraph: null,
    get lingerAoeTelegraph() {
      return lingerAoeTelegraph;
    },
    set lingerAoeTelegraph(v) {
      lingerAoeTelegraph = v;
    },
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
    maskWorldObject,
    ...overrides,
  } as unknown as DefenseSpellDirectorHost;
}

describe("DefenseSpellDirector linger AoE telegraph", () => {
  it("uses PVFX ground flames for flamestrike linger instead of a procedural telegraph", () => {
    const registerSpy = vi.spyOn(
      SpellGroundAoeTelegraph,
      "registerSpellGroundAoeTelegraphWorld",
    );
    const flamesSpy = vi.spyOn(
      FlamestrikePvfx,
      "spawnFlamestrikeGroundFlamesLinger",
    );
    const host = spellDirectorTestHost();
    const director = new DefenseSpellDirector(host);
    const def = spellById("flamestrike");
    expect(def?.lingerMs).toBeGreaterThan(0);

    director.spawnPostChannelLinger(def!);

    expect(host.lingerAoeTelegraph).toBeNull();
    expect(host.spellGroundZones).toHaveLength(1);
    expect(host.spellGroundZones[0]?.destroyLingerFx).toBeTypeOf("function");
    expect(registerSpy).not.toHaveBeenCalled();
    expect(flamesSpy).toHaveBeenCalled();
    expect(host.flashNova).not.toHaveBeenCalled();
    registerSpy.mockRestore();
    flamesSpy.mockRestore();
  });
});
