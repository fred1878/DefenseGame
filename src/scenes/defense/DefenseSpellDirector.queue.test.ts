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
    sprite: { x: 0, y: 0, setVelocity: vi.fn() },
    getFacingAngle: () => 0,
    faceToward: vi.fn(),
  };
  return {
    scene: {} as Phaser.Scene,
    save: { buildings: {} } as unknown as DefenseSpellDirectorHost["save"],
    player: player as unknown as DefenseSpellDirectorHost["player"],
    enemies: [],
    projectiles: [],
    targeting: { focusEnemyId: null } as DefenseSpellDirectorHost["targeting"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: { setVisible: vi.fn(), setPhase: vi.fn(), setProgress: vi.fn(), setWorldPosition: vi.fn() } as unknown as DefenseSpellDirectorHost["castBar"],
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

describe("DefenseSpellDirector spell queue", () => {
  it("enqueues a tap while an instant spell windup is active", () => {
    const spellInputQueue = new SpellInputQueue();
    const spellCaster = new SpellCastController();
    const begun = spellCaster.tryBeginCast("fire_bolt");
    expect(begun).toBe("windup");
    expect(spellCaster.isChanneling()).toBe(true);

    const director = new DefenseSpellDirector(
      spellDirectorTestHost({ spellInputQueue, spellCaster }),
    );

    director.onSpellCastRequest("fire_nova");
    expect(spellInputQueue.peek()).toBe("fire_nova");
  });

  it("enqueues a tap while a channeled spell is active", () => {
    const spellInputQueue = new SpellInputQueue();
    const spellCaster = new SpellCastController();
    spellCaster.tryBeginCast("heal");
    expect(spellCaster.isChanneling()).toBe(true);

    const director = new DefenseSpellDirector(
      spellDirectorTestHost({ spellInputQueue, spellCaster }),
    );

    director.onSpellCastRequest("fire_nova");

    expect(spellInputQueue.peek()).toBe("fire_nova");
  });

  it("flushes a queued spell once channeling and attacks are idle", () => {
    const spellInputQueue = new SpellInputQueue();
    const spellCaster = new SpellCastController();
    const director = new DefenseSpellDirector(
      spellDirectorTestHost({ spellInputQueue, spellCaster }),
    );

    spellCaster.tryBeginCast("heal");
    director.onSpellCastRequest("fire_nova");
    expect(spellInputQueue.peek()).toBe("fire_nova");

    let ticks = 0;
    while (spellCaster.isChanneling() && ticks < 10_000) {
      const result = spellCaster.updateChannel(16, 0, 0);
      if (result.type === "completed") break;
      ticks++;
    }
    expect(spellCaster.isChanneling()).toBe(false);

    const beginSpy = vi
      .spyOn(director, "beginSpellCast")
      .mockImplementation(() => {});
    director.tryFlushQueuedSpellCast(0, 0);
    expect(spellInputQueue.peek()).toBeNull();
    expect(beginSpy).toHaveBeenCalledWith("fire_nova", "manual");
  });

  it("does not auto-cast while a manual spell is queued", () => {
    const spellInputQueue = new SpellInputQueue();
    const spellCaster = new SpellCastController();
    const save = {
      buildings: {},
      spellBar: {
        slots: ["fire_bolt", "fire_nova", "", "", "", "", "", ""],
        autoCastSpellIds: ["fire_bolt"],
      },
    };
    const host = spellDirectorTestHost({
      spellInputQueue,
      spellCaster,
      save: save as unknown as DefenseSpellDirectorHost["save"],
      enemies: [
        {
          id: "e1",
          sprite: { x: 80, y: 0 },
          damageable: { alive: true },
        },
      ] as unknown as DefenseSpellDirectorHost["enemies"],
      targeting: {
        focusEnemyId: "e1",
        setFocusEnemy: vi.fn(),
      } as unknown as DefenseSpellDirectorHost["targeting"],
    });
    const director = new DefenseSpellDirector(host);
    const beginSpy = vi
      .spyOn(director, "beginSpellCast")
      .mockImplementation(() => {});

    spellInputQueue.enqueue("fire_nova");
    director.tryAutoCastSpells(0, 0);

    expect(beginSpy).not.toHaveBeenCalled();
  });

  it("flushes queued spell before auto-cast would fire", () => {
    const spellInputQueue = new SpellInputQueue();
    const spellCaster = new SpellCastController();
    const save = {
      buildings: {},
      spellBar: {
        slots: ["fire_bolt", "fire_nova", "", "", "", "", "", ""],
        autoCastSpellIds: ["fire_bolt"],
      },
    };
    const host = spellDirectorTestHost({
      spellInputQueue,
      spellCaster,
      save: save as unknown as DefenseSpellDirectorHost["save"],
    });
    const director = new DefenseSpellDirector(host);
    const beginSpy = vi
      .spyOn(director, "beginSpellCast")
      .mockImplementation(() => {});

    spellInputQueue.enqueue("fire_nova");
    director.tryFlushQueuedSpellCast(0, 0);
    director.tryAutoCastSpells(0, 0);

    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(beginSpy).toHaveBeenCalledWith("fire_nova", "manual");
  });
});