import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import type { DefenseScene } from "./DefenseScene";
import {
  createDefenseSceneE2eHost,
  type DefenseSceneE2eHost,
} from "./defense/DefenseSceneE2EHost";
import { registerDefenseSceneE2eHostFactory } from "./defense/defenseSceneE2eHook";
import {
  INPUT_MODALITY,
  popInputModality,
  pushInputModality,
} from "../input/inputModality";
import {
  bootToTown,
  seedMathRandom,
  type TownBoot,
} from "../test/scene/townBoot";
import { startNightFromTown } from "../test/scene/sceneFlow";
import {
  setShowCombatRanges,
  setShowEnemyPaths,
  setShowHitboxes,
} from "../debug/DebugState";

const GROUND = ["fire_blast", "blizzard", "meteor", "flamestrike"];

/** Spell-bar gestures (ground aim drag, tap, long press) and world taps. */
describe("DefenseScene input (real Phaser)", () => {
  let boot: TownBoot;
  let defense: DefenseScene;
  let e2e: DefenseSceneE2eHost;
  const h = () => boot.h;

  const hold = () => {
    defense.registry.set("e2eGodMode", true);
    defense.run.wallHp = 1_000_000;
    defense.run.spawnPlanComplete = false;
  };
  const tank = (dx: number, dy: number) => {
    const p = defense.run.player.sprite;
    defense.spawnEnemyAt(p.x + dx, p.y + dy, undefined, "grunt", 100_000);
  };
  const slotCenter = (i: number) => {
    const r = e2e.getSpellSlotHitRects()[i];
    if (!r) throw new Error(`no slot ${i}`);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const screenOf = (dx: number, dy: number) => {
    const p = e2e.playerPosition();
    return e2e.worldPointToScreen(p.x + dx, p.y + dy);
  };

  beforeAll(async () => {
    registerDefenseSceneE2eHostFactory(createDefenseSceneE2eHost);
    seedMathRandom(5);
    boot = await bootToTown({
      save: (s) => ({
        ...s,
        spellBar: {
          slots: [...GROUND, "fire_bolt", "frost_nova", "heal", "swing"],
          autoCastSpellIds: [],
        },
        consumables: { minor_healing_potion: 3, fire_bomb: 3 },
      }),
    });
    defense = await startNightFromTown(boot.h, boot.town);
    e2e = defense.e2e as DefenseSceneE2eHost;
    hold();
    tank(120, 0);
    tank(-120, 40);
  });

  afterAll(async () => {
    await boot?.teardown();
    registerDefenseSceneE2eHostFactory(null);
  });

  it("drag from a ground spell slot onto the field aims and casts it", () => {
    for (let i = 0; i < GROUND.length; i++) {
      hold();
      const from = slotCenter(i);
      const to = screenOf(100, 0);
      h().drag(
        [
          from,
          { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
          to,
          { x: to.x + 2, y: to.y },
        ],
        { holdFrames: 2 },
      );
      expect(defense.run.pendingGroundCast).toBeNull();
      h().step(60 * 5);
    }
  });

  it("dragging a ground spell back onto the bar cancels the aim", () => {
    hold();
    h().step(60 * 10); // cooldowns
    const from = slotCenter(0);
    const mid = screenOf(80, -40);
    h().drag([from, mid, slotCenter(1)], { holdFrames: 2 });
    expect(defense.run.pendingGroundCast).toBeNull();
    h().step(30);
  });

  it("a short tap on a ground slot casts at the auto target; long press toggles auto-cast", () => {
    hold();
    h().step(60 * 10);
    const s = slotCenter(2);
    h().tap(s.x, s.y);
    expect(defense.run.pendingGroundCast).toBeNull();
    h().step(60 * 3);
    const auto0 = defense.run.save.spellBar.autoCastSpellIds?.length ?? 0;
    // Long press is timed on performance.now (wall clock), not game time.
    const realNow = performance.now.bind(performance);
    let skew = 0;
    const spy = vi
      .spyOn(performance, "now")
      .mockImplementation(() => realNow() + skew);
    const longPress = {
      holdFrames: 3,
      beforeRelease: () => {
        skew += 2000;
      },
    };
    h().drag([slotCenter(4)], longPress);
    const auto1 = defense.run.save.spellBar.autoCastSpellIds?.length ?? 0;
    expect(auto1).not.toBe(auto0);
    h().drag([slotCenter(4)], longPress);
    spy.mockRestore();
    expect(defense.run.save.spellBar.autoCastSpellIds?.length ?? 0).toBe(auto0);
  });

  it("programmatic arm / cancel / cast paths", () => {
    hold();
    h().step(60 * 10);
    const pointer = defense.input.activePointer as Phaser.Input.Pointer;
    defense.onGroundCastArm("fire_bolt", pointer); // not a ground spell
    expect(defense.run.pendingGroundCast).toBeNull();
    defense.cancelPendingGroundCast(); // nothing armed: no-op
    defense.onGroundCastArm("meteor", pointer);
    expect(defense.run.pendingGroundCast).toBe("meteor");
    defense.onSpellCastRequest("fire_bolt"); // clears the arm first
    expect(defense.run.pendingGroundCast).toBeNull();
    h().step(60);
  });

  it("world taps: blocked under a modal, select lock, drag on the stick", () => {
    hold();
    const p = screenOf(120, 0);
    pushInputModality(defense, INPUT_MODALITY.debugMenu);
    const select = vi.spyOn(defense.run.targeting, "trySelectEnemyAt");
    h().tap(p.x, p.y);
    expect(select).not.toHaveBeenCalled();
    popInputModality(defense, INPUT_MODALITY.debugMenu.id);
    h().tap(p.x, p.y);
    expect(select).toHaveBeenCalledTimes(1);
    defense.run.targeting.focusSelectLockMs = 500;
    h().tap(p.x, p.y); // inside the focus-select lock window: ignored
    expect(select).toHaveBeenCalledTimes(1);
    select.mockRestore();
    const q = screenOf(-60, 60);
    h().drag([q, { x: q.x + 60, y: q.y }, { x: q.x + 120, y: q.y + 10 }]);
    h().step(10);
  });

  it("Q / E hotkeys: full-HP and no-target toasts, heal, bomb, cooldown", () => {
    hold();
    h().step(60 * 3);
    const key = (k: string, repeat = false) => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: k, repeat }));
      h().step(1);
    };
    const count = (id: string) => defense.run.save.consumables?.[id] ?? 0;
    const d = defense.run.player.damageable;
    d.hp = d.maxHp;
    key("q"); // full HP: toast, no charge
    expect(count("minor_healing_potion")).toBe(3);
    d.hp = 10;
    key("q", true); // key repeat ignored
    expect(count("minor_healing_potion")).toBe(3);
    key("x"); // not a hotkey
    key("q");
    expect(count("minor_healing_potion")).toBe(2);
    key("q"); // cooldown
    expect(count("minor_healing_potion")).toBe(2);
    tank(90, 0);
    h().step(1);
    key("e");
    expect(count("fire_bomb")).toBe(2);
    h().step(60 * 3); // bomb lands; cooldown passes
    e2e.killAllEnemies();
    h().step(2);
    key("e"); // nothing in range
    expect(count("fire_bomb")).toBe(2);
    h().step(60 * 2);
  });

  it("debug overlays: ranges, hitboxes and paths over every enemy kind", () => {
    hold();
    setShowCombatRanges(defense.registry, true);
    setShowHitboxes(defense.registry, true);
    setShowEnemyPaths(defense.registry, true);
    const p = defense.run.player.sprite;
    const kinds = [
      "grunt",
      "bruiser",
      "charger",
      "lobber",
      "sentry_archer",
      "javelineer",
      "reaver",
      "slow_siege",
    ];
    kinds.forEach((kind, i) => {
      const a = (i / kinds.length) * Math.PI * 2;
      defense.spawnEnemyAt(
        p.x + Math.cos(a) * 220,
        p.y + Math.sin(a) * 220,
        undefined,
        kind,
        100_000,
      );
    });
    for (let i = 0; i < 6; i++) {
      hold();
      h().step(60);
    }
    setShowCombatRanges(defense.registry, false);
    h().step(5);
    setShowCombatRanges(defense.registry, true);
    setShowHitboxes(defense.registry, false);
    h().step(5);
    setShowCombatRanges(defense.registry, false);
    setShowEnemyPaths(defense.registry, false);
    h().step(5);
    e2e.killAllEnemies();
    h().step(2);
  });

  it("ending twice is a no-op; HUD text stops refreshing after the end", () => {
    defense.registry.set("e2eGodMode", false);
    e2e.setManualReturn(true);
    e2e.forceWinNight();
    h().step(2);
    expect(e2e.nightEnded()).toBe(true);
    defense.endNight(false);
    defense.leaveTrainingRun();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" })); // canAct false
    h().step(5);
    expect(e2e.nightEnded()).toBe(true);
  });
});
