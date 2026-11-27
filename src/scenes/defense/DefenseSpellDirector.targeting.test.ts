import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { applySpellInputTuning } from "../../config/spellInput";
import { normalizeSpellInput } from "../../core/data/normalizeSpellInput";
import shippedSpellInput from "../../../public/data/spell_input.json";
import { SpellCastController } from "../../combat/rules/SpellCastController";
import { SpellInputQueue } from "../../combat/rules/spellInputQueue";
import type { SpellDefinition } from "../../content/spells";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./DefenseSpellDirector";
import { GroundTargetReticle } from "../../ui/hud/GroundTargetReticle";

applySpellInputTuning(
  normalizeSpellInput({
    ...shippedSpellInput,
    groundTapAutoCastSpellIds: ["blizzard"],
  }),
);

const deepFreezeDef: SpellDefinition = {
  id: "deep_freeze",
  name: "Deep Freeze",
  shortLabel: "DF",
  mechanicType: "instant_targeted",
  castableInDefense: true,
  implementationPhase: 4,
  cooldownMs: 1000,
  channelMs: 0,
  iconFile: "deep_freeze.png",
  targetMode: "enemy",
  requireEnemyTarget: true,
};

function makeHost(
  overrides: Partial<DefenseSpellDirectorHost> = {},
): DefenseSpellDirectorHost {
  return {
    scene: {} as DefenseSpellDirectorHost["scene"],
    save: { buildings: {} } as DefenseSpellDirectorHost["save"],
    player: {
      canAttack: () => true,
      sprite: { x: 0, y: 0, setVelocity: vi.fn() },
      getFacingAngle: () => 0,
      faceToward: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["player"],
    projectiles: [],
    targeting: {
      focusEnemyId: null,
      setFocusEnemy: vi.fn(),
      facingTarget: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["targeting"],
    spellBar: {} as DefenseSpellDirectorHost["spellBar"],
    castBar: {
      setVisible: vi.fn(),
      setPhase: vi.fn(),
      setProgress: vi.fn(),
      setWorldPosition: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["castBar"],
    groundReticle: {
      showAt: vi.fn(),
      hide: vi.fn(),
    } as unknown as DefenseSpellDirectorHost["groundReticle"],
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
    iceCastWindupFx: null,
    channelAreaStarted: false,
    shadowformEndsAt: 0,
    iceWallExpires: [],
    wu: (n: number) => n,
    enemies: [
      {
        id: "e1",
        sprite: { x: 80, y: 0, displayWidth: 48, active: true },
        damageable: { alive: true },
      },
    ] as unknown as DefenseSpellDirectorHost["enemies"],
    enemyTargets: () => [{ id: "e1", x: 80, y: 0, radius: 12, alive: true }],
    resolveStrikeMode: () => "ranged" as const,
    flashNova: vi.fn(),
    nextProjectileId: () => "0",
    filterDeadEnemies: vi.fn(),
    timeNow: () => 0,
    delayedCall: vi.fn(),
    enemySpellStatus: {} as DefenseSpellDirectorHost["enemySpellStatus"],
    enemyIceRootFx: { tick: vi.fn(), reset: vi.fn() },
    enemyIceStunFx: { tick: vi.fn(), reset: vi.fn() },
    spellInputQueue: new SpellInputQueue(),
    spellCaster: new SpellCastController(),
    ...overrides,
  } as DefenseSpellDirectorHost;
}

describe("DefenseSpellDirector manual targeting", () => {
  it("prepareManualCastTargeting acquires focus for deep_freeze", () => {
    const targeting = {
      focusEnemyId: null,
      setFocusEnemy: vi.fn(),
      facingTarget: vi.fn(),
    };
    const director = new DefenseSpellDirector(
      makeHost({
        targeting:
          targeting as unknown as DefenseSpellDirectorHost["targeting"],
      }),
    );
    expect(director.prepareManualCastTargeting(deepFreezeDef)).toBe(true);
    expect(targeting.setFocusEnemy).toHaveBeenCalledWith("e1");
  });

  it("returns false when no valid combat target exists", () => {
    const director = new DefenseSpellDirector(
      makeHost({ enemies: [], enemyTargets: () => [] }),
    );
    expect(director.prepareManualCastTargeting(deepFreezeDef)).toBe(false);
  });

  it("allows fire_bolt with no enemies present", () => {
    const director = new DefenseSpellDirector(
      makeHost({ enemies: [], enemyTargets: () => [] }),
    );
    expect(
      director.prepareManualCastTargeting({
        id: "fire_bolt",
        name: "Fire Bolt",
        shortLabel: "Fire",
        mechanicType: "projectile",
        castableInDefense: true,
        implementationPhase: 1,
        cooldownMs: 0,
        channelMs: 0,
        iconFile: "fire_bolt.png",
      }),
    ).toBe(true);
  });

  it.each(["blizzard", "meteor", "flamestrike"] as const)(
    "tap-casts %s without entering pending ground aim",
    (spellId) => {
      const h = makeHost();
      const director = new DefenseSpellDirector(h);
      director.onSpellCastRequest(spellId);
      expect(h.pendingGroundCast).toBeNull();
      expect(h.groundAim).not.toBeNull();
    },
  );

  it("tap-casts ground AoE with no enemies along the facing direction", () => {
    const h = makeHost({ enemies: [], enemyTargets: () => [] });
    const director = new DefenseSpellDirector(h);
    const beginSpy = vi
      .spyOn(director, "beginSpellCast")
      .mockImplementation(() => {});

    director.onSpellCastRequest("meteor");

    expect(h.pendingGroundCast).toBeNull();
    expect(h.groundAim).not.toBeNull();
    expect(beginSpy).toHaveBeenCalledWith("meteor", "manual", 0, 0);
  });

  it("tap-casts fire_blast without entering pending ground aim", () => {
    const h = makeHost();
    const director = new DefenseSpellDirector(h);
    vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});
    director.onSpellCastRequest("fire_blast");
    expect(h.pendingGroundCast).toBeNull();
    expect(h.groundAim).not.toBeNull();
  });
});

describe("DefenseSpellDirector.armGroundCast", () => {
  it("arms a ground spell without casting", () => {
    vi.spyOn(GroundTargetReticle, "radiusForSpell").mockReturnValue(50);
    const h = makeHost();
    const director = new DefenseSpellDirector(h);
    vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});
    director.armGroundCast("meteor");
    expect(h.pendingGroundCast).toBe("meteor");
    expect(h.groundAim).not.toBeNull();
    expect(h.groundReticle.showAt).toHaveBeenCalled();
    expect(director.beginSpellCast).not.toHaveBeenCalled();
  });

  it("arms on empty ground when no enemy is nearby", () => {
    vi.spyOn(GroundTargetReticle, "radiusForSpell").mockReturnValue(50);
    const h = makeHost({ enemies: [], enemyTargets: () => [] });
    const director = new DefenseSpellDirector(h);
    vi.spyOn(director, "beginSpellCast").mockImplementation(() => {});
    director.armGroundCast("meteor");
    expect(h.pendingGroundCast).toBe("meteor");
    expect(h.groundAim).not.toBeNull();
    expect(director.beginSpellCast).not.toHaveBeenCalled();
  });

  it("ignores instant spells", () => {
    const h = makeHost();
    const director = new DefenseSpellDirector(h);
    director.armGroundCast("fire_bolt");
    expect(h.pendingGroundCast).toBeNull();
    expect(h.groundReticle.showAt).not.toHaveBeenCalled();
  });
});
