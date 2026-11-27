import { describe, expect, it, vi } from "vitest";
import { resolveEnemyCombat } from "../../core/enemyTuning";
import { createRangedHybridCombatState } from "../../entities/EnemyRangedCombat";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { buildNavGrid } from "../../pathfinding/grid";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";
import { createEnemyNav } from "../brainShared";
import { rangedHybridBehavior } from "./rangedHybrid";

const grid = buildNavGrid([], 40);
const base = shippedEnemyCombat("reaver");
const combatTuning = resolveEnemyCombat(
  "rangedHybrid",
  {
    ...base,
    melee: { ...base.melee!, triggerRangeWu: 40 },
    stationaryRanged: {
      ...base.stationaryRanged!,
      kiteBandSlackWu: 20,
      attackTriggerRangeWu: 300,
    },
    hybrid: { ...base.hybrid!, preferredRangeWu: 200, retreatRangeSlackWu: 12 },
  },
  "reaver",
);

function setup(mode: "ranged" | "melee" | "retreat" | null, x = 0, y = 0) {
  const setVelocity = vi.fn();
  const enemy = mockEnemyInstance({
    behavior: "rangedHybrid",
    defId: "reaver",
    combatTuning,
    sprite: {
      x,
      y,
      setVelocity,
      body: { velocity: { x: 0, y: 0 } },
      scene: { registry: { get: () => undefined } },
    } as never,
    nav: createEnemyNav(),
  });
  if (mode) {
    enemy.rangedHybrid = createRangedHybridCombatState();
    enemy.rangedHybrid.mode = mode;
  } else {
    delete enemy.rangedHybrid;
  }
  const tick = (
    playerX: number,
    playerY = 0,
    objective: "huntPlayer" | "defendWall" = "huntPlayer",
  ) =>
    rangedHybridBehavior({
      enemy,
      nav: enemy.nav,
      grid,
      playerX,
      playerY,
      deltaMs: 16,
      objective,
    });
  const lastV = () => {
    const call = setVelocity.mock.calls.at(-1);
    if (!call) throw new Error("setVelocity not called");
    return { vx: call[0] as number, vy: call[1] as number };
  };
  return { enemy, tick, lastV };
}

describe("rangedHybridBehavior", () => {
  it("retreat mode backs away from the player", () => {
    const { tick, lastV } = setup("retreat");
    const res = tick(60);
    expect(res.targetKind).toBe("player");
    expect(lastV().vx).toBeLessThan(0);
  });

  it("holds still while a ranged attack is in progress", () => {
    const { enemy, tick } = setup("ranged");
    enemy.combat.phase = "windup";
    tick(250);
    expect(enemy.sprite.setVelocity).toHaveBeenLastCalledWith(0, 0);
  });

  it("melee mode chases the player", () => {
    const { tick, lastV } = setup("melee");
    tick(150);
    expect(lastV().vx).toBeGreaterThan(0);
  });

  it("ranged mode closes in when the player is inside melee engage range", () => {
    const { tick, lastV } = setup("ranged");
    tick(30);
    expect(lastV().vx).toBeGreaterThan(0);
  });

  it("ranged mode kites: retreat inside the band, hold in range, approach when far", () => {
    const near = setup("ranged");
    near.tick(100);
    expect(near.lastV().vx).toBeLessThan(0);

    const inRange = setup("ranged");
    inRange.tick(250);
    expect(inRange.enemy.sprite.setVelocity).toHaveBeenLastCalledWith(0, 0);

    const far = setup("ranged");
    far.tick(600);
    expect(far.lastV().vx).toBeGreaterThan(0);
    expect(far.enemy.nav.replanMs).toBeGreaterThan(0);
  });

  it("without hybrid state it paths toward the wall", () => {
    const { tick, lastV, enemy } = setup(null, 0, 200);
    const res = tick(0, 900, "defendWall");
    expect(res.targetKind).toBe("wall");
    expect(enemy.nav.path.length).toBeGreaterThan(0);
    expect(lastV().vy).toBeLessThan(0);
  });
});
