import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { playerTuning } from "../../config/player";
import type { EnemyInstance } from "../../entities/Enemy";
import type { Player } from "../../entities/Player";
import { FOCUS_SELECT_LOCK_MS } from "../../input/inputTuning";
import type { TargetIndicator } from "../../ui/hud/TargetIndicator";
import {
  DefenseTargeting,
  type DefenseTargetingHost,
} from "./DefenseTargeting";

type E = { id: string; x: number; y: number; alive?: boolean };

function enemy(e: E): EnemyInstance {
  return {
    id: e.id,
    sprite: { x: e.x, y: e.y },
    damageable: { alive: e.alive ?? true },
  } as unknown as EnemyInstance;
}

function harness(list: E[], hits: Phaser.GameObjects.GameObject[] = []) {
  let enemies = list.map(enemy);
  const indicator = {
    attachTo: vi.fn(),
    detach: vi.fn(),
    updateWorldPosition: vi.fn(),
  };
  // Real Phaser needs a scene; the test stub's Container takes no arguments.
  const Ctor = Phaser.GameObjects.Container as unknown as new () => {
    list: unknown[];
  };
  const blocker = new Ctor();
  blocker.list = [];
  const scene = { scale: { width: 540, height: 1200 } } as Phaser.Scene;
  const host: DefenseTargetingHost = {
    scene,
    registry: {} as Phaser.Data.DataManager,
    scale: scene.scale,
    input: {
      hitTestPointer: () => hits,
    } as unknown as Phaser.Input.InputPlugin,
    player: { sprite: { x: 0, y: 0 } } as unknown as Player,
    getEnemies: () => enemies,
    targetIndicator: indicator as unknown as TargetIndicator,
    uiBlockers: [blocker as unknown as Phaser.GameObjects.GameObject],
    safe: { top: 0, bottom: 0, left: 0, right: 0 },
    wu: (v) => v,
  };
  return {
    t: new DefenseTargeting(host),
    indicator,
    blocker,
    setEnemies: (next: E[]) => {
      enemies = next.map(enemy);
    },
  };
}

describe("DefenseTargeting with a live host", () => {
  it("taps the nearest living enemy within the tap radius and locks selection", () => {
    const r = playerTuning().targetTapRadiusWu;
    const { t, indicator } = harness([
      { id: "far", x: r * 0.9, y: 0 },
      { id: "near", x: r * 0.2, y: 0 },
      { id: "dead", x: 0, y: 0, alive: false },
    ]);
    t.trySelectEnemyAt(0, 0);
    expect(t.focusEnemyId).toBe("near");
    expect(t.focusSelectLockMs).toBe(FOCUS_SELECT_LOCK_MS);
    expect(indicator.attachTo).toHaveBeenCalledTimes(1);

    t.trySelectEnemyAt(r * 10, r * 10);
    expect(t.focusEnemyId).toBeNull();
    expect(indicator.detach).toHaveBeenCalled();
  });

  it("drops focus when the focused enemy is dead or gone", () => {
    const h = harness([{ id: "a", x: 5, y: 0 }]);
    h.t.setFocusEnemy("a");
    h.t.syncFocusTarget();
    expect(h.indicator.updateWorldPosition).toHaveBeenCalledTimes(2);
    h.setEnemies([{ id: "a", x: 5, y: 0, alive: false }]);
    h.t.syncFocusTarget();
    expect(h.t.focusEnemyId).toBeNull();
    h.t.setFocusEnemy("missing");
    expect(h.t.focusEnemyId).toBeNull();
    h.t.syncFocusTarget();
    h.t.resetForNewRun();
    expect(h.t.focusSelectLockMs).toBe(0);
  });

  it("faces the focused enemy, falling back to the nearest in range", () => {
    const melee = playerTuning().autoAttackMeleeRange;
    const ranged = playerTuning().autoAttackRangedRange;
    const { t } = harness([
      { id: "close", x: melee * 0.5, y: 0 },
      { id: "mid", x: ranged * 0.8, y: 0 },
      { id: "out", x: ranged * 3, y: 0 },
    ]);
    expect(t.facingTarget("melee", false)).toEqual({ x: melee * 0.5, y: 0 });
    expect(t.facingTarget("auto", false)).toEqual({ x: melee * 0.5, y: 0 });
    t.setFocusEnemy("mid");
    expect(t.facingTarget("ranged", false)).toEqual({ x: ranged * 0.8, y: 0 });
    t.setFocusEnemy("out");
    // Out of range: auto falls back to nearest; manual still faces the focus.
    expect(t.facingTarget("ranged", false)).toEqual({ x: melee * 0.5, y: 0 });
    expect(t.facingTarget("ranged", true)).toEqual({ x: ranged * 3, y: 0 });
    expect(harness([]).t.nearestEnemyForMode("melee")).toBeNull();
  });

  it("treats the top HUD band and UI blockers (and their children) as UI", () => {
    const child = {} as Phaser.GameObjects.GameObject;
    const nested = {
      parentContainer: undefined,
    } as unknown as Phaser.GameObjects.GameObject;
    const h = harness([], [child]);
    h.blocker.list.push(child);
    expect(h.t.isPointerOverUi({ x: 10, y: 1 } as Phaser.Input.Pointer)).toBe(
      true,
    );
    expect(h.t.isPointerOverUi({ x: 10, y: 600 } as Phaser.Input.Pointer)).toBe(
      true,
    );
    const h2 = harness([], [nested]);
    (nested as unknown as { parentContainer: unknown }).parentContainer =
      h2.blocker;
    expect(
      h2.t.isPointerOverUi({ x: 10, y: 600 } as Phaser.Input.Pointer),
    ).toBe(true);
    const h3 = harness([], [{} as Phaser.GameObjects.GameObject]);
    expect(
      h3.t.isPointerOverUi({ x: 10, y: 600 } as Phaser.Input.Pointer),
    ).toBe(false);
  });
});
