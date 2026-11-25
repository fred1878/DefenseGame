import { describe, expect, it, vi } from "vitest";
import * as SpellGroundAoeTelegraph from "../../combat/SpellGroundAoeTelegraph";
import { SpellCastController } from "../../combat/SpellCastController";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";

describe("DefenseSpellDirector cast interrupt cleanup", () => {
  it("clears ground telegraphs and aim reticle when windup is interrupted", () => {
    const destroySpy = vi.spyOn(
      SpellGroundAoeTelegraph,
      "destroySpellGroundAoeTelegraph",
    );
    const gfx = {
      setDepth: vi.fn(),
      clear: vi.fn(),
      lineStyle: vi.fn(),
      fillStyle: vi.fn(),
      strokeCircle: vi.fn(),
      fillCircle: vi.fn(),
      destroy: vi.fn(),
    };
    const groundReticle = { showAt: vi.fn(), hide: vi.fn() };
    const spellCaster = new SpellCastController();
    spellCaster.tryBeginCast("flamestrike", "auto");
    const groundAoeTelegraph: SpellGroundAoeTelegraph.SpellGroundAoeTelegraph =
      {
        gfx: gfx as unknown as Phaser.GameObjects.Graphics,
        zoneX: 50,
        zoneY: 60,
        zoneRadius: 78,
        phaseMs: 0,
        palette: { fill: 0xff5533, stroke: 0xffcc66, inner: 0xffffff },
        mode: "windup",
        windupMs: 650,
      };

    const host = {
      scene: {
        registry: { get: () => undefined },
        add: { graphics: () => gfx },
      } as unknown as Phaser.Scene,
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
      groundReticle,
      obstacleGroup: {} as Phaser.Physics.Arcade.StaticGroup,
      spellChannelArea: { x: 50, y: 60 },
      spellGroundZones: [],
      pendingGroundCast: "flamestrike",
      groundAim: { x: 50, y: 60 },
      groundAoeTelegraph,
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

    const director = new DefenseSpellDirector(host);
    director.updateChanneling(16, { x: 0, y: 0 }, () => false);
    director.updateChanneling(8, { x: 0.5, y: 0 }, () => false);

    expect(destroySpy).toHaveBeenCalled();
    expect(groundReticle.hide).toHaveBeenCalled();
    expect(host.pendingGroundCast).toBeNull();
    expect(host.groundAim).toBeNull();
    expect(host.groundAoeTelegraph).toBeNull();
    destroySpy.mockRestore();
  });
});
