import { describe, expect, it, vi } from "vitest";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";
import * as SpellGroundAoeTelegraph from "../../combat/SpellGroundAoeTelegraph";
import { spellById } from "../../content/spells";

function spellDirectorTestHost(
  overrides: Partial<DefenseSpellDirectorHost> = {},
): DefenseSpellDirectorHost {
  const spellGroundZones: DefenseSpellDirectorHost["spellGroundZones"] = [];
  const player = {
    sprite: { x: 50, y: 60 },
  };
  let lingerAoeTelegraph: DefenseSpellDirectorHost["lingerAoeTelegraph"] = null;
  const maskWorldObject = vi.fn();
  const gfx = {
    setDepth: vi.fn(),
    clear: vi.fn(),
    lineStyle: vi.fn(),
    fillStyle: vi.fn(),
    strokeCircle: vi.fn(),
    fillCircle: vi.fn(),
    destroy: vi.fn(),
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
    targeting: {} as DefenseSpellDirectorHost["targeting"],
    spellCaster: {} as DefenseSpellDirectorHost["spellCaster"],
    spellInputQueue: {} as DefenseSpellDirectorHost["spellInputQueue"],
    enemySpellStatus: {} as DefenseSpellDirectorHost["enemySpellStatus"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: {} as DefenseSpellDirectorHost["castBar"],
    groundReticle: { hide: vi.fn() } as unknown as DefenseSpellDirectorHost["groundReticle"],
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
  it("spawns and registers a linger telegraph for flamestrike", () => {
    const registerSpy = vi.spyOn(SpellGroundAoeTelegraph, "registerSpellGroundAoeTelegraphWorld");
    const host = spellDirectorTestHost();
    const director = new DefenseSpellDirector(host);
    const def = spellById("flamestrike");
    expect(def?.lingerMs).toBeGreaterThan(0);

    director.spawnPostChannelLinger(def!);

    expect(host.lingerAoeTelegraph).not.toBeNull();
    expect(host.spellGroundZones).toHaveLength(1);
    expect(registerSpy).toHaveBeenCalledWith(
      host.lingerAoeTelegraph,
      host.maskWorldObject,
    );
    registerSpy.mockRestore();
  });
});