import { describe, expect, it, vi } from "vitest";
import { SpellCastController } from "../../combat/SpellCastController";
import { SpellInputQueue } from "../../combat/spellInputQueue";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";

function spellDirectorTestHost(
  overrides: Partial<DefenseSpellDirectorHost> & {
    spellInputQueue: SpellInputQueue;
    spellCaster: SpellCastController;
  },
): DefenseSpellDirectorHost {
  const player = {
    canAttack: () => true,
    mode: "auto" as const,
    sprite: { x: 0, y: 0, setVelocity: vi.fn() },
    getFacingAngle: () => 0,
    faceToward: vi.fn(),
  };
  const save = {
    buildings: {},
    spellBar: {
      slots: ["meteor", "", "", "", "", "", "", ""],
      autoCastSpellIds: ["meteor"],
    },
  };
  return {
    scene: {} as Phaser.Scene,
    save: save as unknown as DefenseSpellDirectorHost["save"],
    player: player as unknown as DefenseSpellDirectorHost["player"],
    enemies: [],
    projectiles: [],
    targeting: {
      focusEnemyId: null,
      setFocusEnemy: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["targeting"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: {
      setVisible: vi.fn(),
      setPhase: vi.fn(),
      setProgress: vi.fn(),
      setWorldPosition: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["castBar"],
    groundReticle: { showAt: vi.fn(), hide: vi.fn() } as unknown as DefenseSpellDirectorHost["groundReticle"],
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
    enemyTargets: () => [],
    resolveStrikeMode: () => "ranged" as const,
    flashNova: vi.fn(),
    nextProjectileId: () => "0",
    filterDeadEnemies: vi.fn(),
    timeNow: () => 0,
    delayedCall: vi.fn(),
    enemySpellStatus: {} as unknown as DefenseSpellDirectorHost["enemySpellStatus"],
    ...overrides,
  } as unknown as DefenseSpellDirectorHost;
}

describe("DefenseSpellDirector auto-cast target guard", () => {
  it("does not cast ground AoE auto-cast spells with no living enemies", () => {
    const director = new DefenseSpellDirector(
      spellDirectorTestHost({
        spellInputQueue: new SpellInputQueue(),
        spellCaster: new SpellCastController(),
      }),
    );
    const beginSpy = vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});

    director.tryAutoCastSpells(0, 0);

    expect(beginSpy).not.toHaveBeenCalled();
  });

  it("casts ground AoE when a combat target exists", () => {
    const host = spellDirectorTestHost({
      spellInputQueue: new SpellInputQueue(),
      spellCaster: new SpellCastController(),
      enemies: [
        {
          id: "e1",
          sprite: { x: 100, y: 0 },
          damageable: { alive: true },
        },
      ] as unknown as DefenseSpellDirectorHost["enemies"],
    });
    const director = new DefenseSpellDirector(host);
    const beginSpy = vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});

    director.tryAutoCastSpells(0, 0);

    expect(beginSpy).toHaveBeenCalledWith("meteor");
    expect(host.groundAim).toEqual({ x: 100, y: 0 });
  });

  it("auto-casts flamestrike on nearest enemy in ground range", () => {
    const save = {
      buildings: {},
      spellBar: {
        slots: ["flamestrike", "", "", "", "", "", "", ""],
        autoCastSpellIds: ["flamestrike"],
      },
    };
    const host = spellDirectorTestHost({
      spellInputQueue: new SpellInputQueue(),
      spellCaster: new SpellCastController(),
      save: save as unknown as DefenseSpellDirectorHost["save"],
      enemies: [
        {
          id: "e1",
          sprite: { x: 0, y: 90 },
          damageable: { alive: true },
        },
        {
          id: "e2",
          sprite: { x: 180, y: 0 },
          damageable: { alive: true },
        },
      ] as unknown as DefenseSpellDirectorHost["enemies"],
    });
    const director = new DefenseSpellDirector(host);
    const beginSpy = vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});

    director.tryAutoCastSpells(0, 0);

    expect(beginSpy).toHaveBeenCalledWith("flamestrike");
    expect(host.groundAim).toEqual({ x: 0, y: 90 });
  });

  it("still auto-casts self-centered spells with no enemies", () => {
    const save = {
      buildings: {},
      spellBar: {
        slots: ["fire_nova", "", "", "", "", "", "", ""],
        autoCastSpellIds: ["fire_nova"],
      },
    };
    const director = new DefenseSpellDirector(
      spellDirectorTestHost({
        spellInputQueue: new SpellInputQueue(),
        spellCaster: new SpellCastController(),
        save: save as unknown as DefenseSpellDirectorHost["save"],
      }),
    );
    const beginSpy = vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});

    director.tryAutoCastSpells(0, 0);

    expect(beginSpy).toHaveBeenCalledWith("fire_nova");
  });
});