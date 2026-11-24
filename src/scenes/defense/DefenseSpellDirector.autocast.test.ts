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

    expect(beginSpy).toHaveBeenCalledWith("meteor", "auto", 0, 0);
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

    expect(beginSpy).toHaveBeenCalledWith("flamestrike", "auto", 0, 0);
    expect(host.groundAim).toEqual({ x: 0, y: 90 });
  });

  it("auto-casts ground AoE toward max range when enemy is beyond ground max range", () => {
    const host = spellDirectorTestHost({
      spellInputQueue: new SpellInputQueue(),
      spellCaster: new SpellCastController(),
      enemies: [
        {
          id: "e1",
          sprite: { x: 500, y: 0, displayWidth: 40 },
          damageable: { alive: true },
        },
      ] as unknown as DefenseSpellDirectorHost["enemies"],
    });
    const director = new DefenseSpellDirector(host);
    const beginSpy = vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});

    director.tryAutoCastSpells(0, 0);

    expect(beginSpy).toHaveBeenCalledWith("meteor", "auto", 0, 0);
    expect(host.groundAim?.x).toBeCloseTo(240, 5);
    expect(host.groundAim?.y).toBeCloseTo(0, 5);
  });

  it("auto-casts instant water bolt toward nearest enemy in ranged band", () => {
    const save = {
      buildings: {},
      spellBar: {
        slots: ["water_bolt", "", "", "", "", "", "", ""],
        autoCastSpellIds: ["water_bolt"],
      },
    };
    const faceToward = vi.fn();
    const setFocusEnemy = vi.fn();
    const host = spellDirectorTestHost({
      spellInputQueue: new SpellInputQueue(),
      spellCaster: new SpellCastController(),
      save: save as unknown as DefenseSpellDirectorHost["save"],
      enemies: [
        {
          id: "e1",
          sprite: { x: 120, y: 40, displayWidth: 40 },
          damageable: { alive: true },
        },
      ] as unknown as DefenseSpellDirectorHost["enemies"],
      player: {
        canAttack: () => true,
        mode: "auto" as const,
        sprite: { x: 0, y: 0, setVelocity: vi.fn() },
        getFacingAngle: () => 0,
        faceToward,
      } as unknown as DefenseSpellDirectorHost["player"],
      targeting: {
        focusEnemyId: null,
        setFocusEnemy,
        facingTarget: vi.fn(),
      } as unknown as DefenseSpellDirectorHost["targeting"],
    });
    const director = new DefenseSpellDirector(host);
    const beginSpy = vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});

    director.tryAutoCastSpells(0, 0);

    expect(beginSpy).toHaveBeenCalledWith("water_bolt", "auto", 0, 0);
    expect(setFocusEnemy).toHaveBeenCalledWith("e1");
    expect(faceToward).toHaveBeenCalledWith(120, 40);
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

    expect(beginSpy).toHaveBeenCalledWith("fire_nova", "auto", 0, 0);
  });
});