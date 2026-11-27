import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";

vi.mock("../../combat/fx/EnemyIceRootFx", () => ({
  EnemyIceRootFxController: class {},
}));
vi.mock("../../combat/fx/EnemyIceStunFx", () => ({
  EnemyIceStunFxController: class {},
}));

import { DefenseRunState, type DefenseServices } from "./DefenseRunState";
import type { EnemyInstance } from "../../entities/Enemy";

function services(over: Partial<DefenseServices> = {}): DefenseServices {
  return {
    wu: (n) => n,
    enemyTargets: () => [],
    resolveStrikeMode: () => "melee",
    flashNova: () => {},
    timeNow: () => 0,
    delayedCall: () => {},
    registerWorldDraw: () => {},
    beginSpellCast: () => {},
    onPendingGroundCastChanged: () => {},
    ...over,
  };
}

const scene = {} as Phaser.Scene;
const enemy = (id: string, alive: boolean) =>
  ({ id, damageable: { alive } }) as unknown as EnemyInstance;

describe("DefenseRunState", () => {
  it("filters dead enemies in place, keeping order and identity", () => {
    const run = new DefenseRunState(scene, services());
    const list = [enemy("a", true), enemy("b", false), enemy("c", true)];
    run.enemies = list;
    run.filterDeadEnemies();
    expect(run.enemies).toBe(list);
    expect(run.enemies.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("notifies pending ground cast changes", () => {
    const onChange = vi.fn();
    const run = new DefenseRunState(
      scene,
      services({ onPendingGroundCastChanged: onChange }),
    );
    run.pendingGroundCast = "blizzard";
    expect(run.pendingGroundCast).toBe("blizzard");
    run.pendingGroundCast = null;
    expect(onChange.mock.calls).toEqual([["blizzard"], [null]]);
  });

  it("hands out sequential projectile ids from one serial", () => {
    const run = new DefenseRunState(scene, services());
    expect(run.nextPlayerProjectileId()).toBe("p_0");
    expect(run.nextProjectileId()).toBe("spell_proj_1");
  });
});
