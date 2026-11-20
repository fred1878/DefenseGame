import { describe, expect, it, vi } from "vitest";
import { createEnemyNav } from "../EnemyBrain";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import type { EnemyBehaviorExtra } from "../../entities/Enemy";
import {
  evaluateWardPostHold,
  pickWardProtectee,
  wardBehavior,
  wardPostHoldBroken,
  wardScreenPoint,
  WARD_POST_BREAK_MOVE_PX,
  WARD_POST_GRACE_MS,
} from "./ward";

function freshWardExtra(): EnemyBehaviorExtra {
  return {
    strafeSign: 1,
    strafeFlipMs: 0,
    chargeWindupMs: 0,
    chargeActiveMs: 0,
    chargeCooldownMs: 0,
    chargeAimX: 0,
    chargeAimY: 0,
    chargeDashDirX: 0,
    chargeDashDirY: 0,
    wardPostGraceMs: 0,
    wardPostSnapPlayerX: 0,
    wardPostSnapPlayerY: 0,
    wardPostSnapAllyX: 0,
    wardPostSnapAllyY: 0,
    wardPostAnchorGoalX: 0,
    wardPostAnchorGoalY: 0,
    wardPostWasInHoldRadius: false,
  };
}

describe("ward behavior helpers", () => {
  it("picks the nearest ranged ally within protect radius", () => {
    const allies = [
      { id: "a", behavior: "meleeChaser", x: 50, y: 0 },
      { id: "b", behavior: "javelineer", x: 80, y: 0 },
      { id: "c", behavior: "arrowRainArcher", x: 120, y: 0 },
    ];
    const pick = pickWardProtectee(allies, 0, 0, 200);
    expect(pick?.id).toBe("b");
  });

  it("places screen point between ally and player", () => {
    const p = wardScreenPoint(100, 0, 0, 0, 0.5);
    expect(p.x).toBe(50);
    expect(p.y).toBe(0);
  });
});

describe("ward post hold", () => {
  it("enters grace and holds on arrival at post", () => {
    const extra = freshWardExtra();
    const decision = evaluateWardPostHold(
      extra,
      16,
      true,
      50,
      0,
      100,
      0,
      0,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    expect(decision.hold).toBe(true);
    expect(decision.skipReplan).toBe(true);
    expect(extra.wardPostGraceMs).toBe(WARD_POST_GRACE_MS - 16);
  });

  it("ignores sub-break player jitter during grace", () => {
    const extra = freshWardExtra();
    evaluateWardPostHold(
      extra,
      16,
      true,
      50,
      0,
      100,
      0,
      0,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    const decision = evaluateWardPostHold(
      extra,
      16,
      true,
      51,
      0,
      110,
      3,
      0,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    expect(decision.hold).toBe(true);
    expect(wardPostHoldBroken(extra, 110, 3, 0, 0, WARD_POST_BREAK_MOVE_PX, true)).toBe(
      false,
    );
  });

  it("breaks grace when the player moves meaningfully", () => {
    const extra = freshWardExtra();
    evaluateWardPostHold(
      extra,
      16,
      true,
      50,
      0,
      100,
      0,
      0,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    const decision = evaluateWardPostHold(
      extra,
      16,
      true,
      80,
      0,
      160,
      0,
      0,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    expect(decision.hold).toBe(false);
    expect(decision.skipReplan).toBe(false);
    expect(extra.wardPostGraceMs).toBe(0);
  });

  it("breaks grace when the protectee moves meaningfully", () => {
    const extra = freshWardExtra();
    evaluateWardPostHold(
      extra,
      16,
      true,
      50,
      0,
      100,
      0,
      0,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    const decision = evaluateWardPostHold(
      extra,
      16,
      true,
      50,
      0,
      100,
      0,
      60,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    expect(decision.hold).toBe(false);
  });

  it("ends grace after timeout", () => {
    const extra = freshWardExtra();
    evaluateWardPostHold(
      extra,
      16,
      true,
      50,
      0,
      100,
      0,
      0,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    extra.wardPostGraceMs = 1;
    const decision = evaluateWardPostHold(
      extra,
      16,
      true,
      50,
      0,
      100,
      0,
      0,
      0,
      WARD_POST_BREAK_MOVE_PX,
    );
    expect(decision.hold).toBe(false);
    expect(extra.wardPostGraceMs).toBe(0);
  });
});

describe("wardBehavior", () => {
  const openGrid = {
    blocked: () => false,
    width: 1,
    height: 1,
    cellSize: 40,
  } as unknown as import("../../pathfinding/grid").NavGrid;

  it("stands still at the screen post and faces the player", () => {
    const setVelocity = vi.fn();
    const enemy = mockEnemyInstance({
      behavior: "ward",
      defId: "ward",
      sprite: {
        x: 83,
        y: 1,
        setVelocity,
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
      nav: { ...createEnemyNav(), path: [{ x: 83, y: 1 }], pathIndex: 1 },
    });

    wardBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 200,
      playerY: 0,
      deltaMs: 16,
      peerAllies: [{ id: "jav", behavior: "javelineer", x: 0, y: 0 }],
    });

    expect(setVelocity).toHaveBeenCalledWith(0, 0);
    expect(enemy.combat.facing).toBeCloseTo(Math.atan2(0 - 1, 200 - 83), 4);
  });

  it("paths toward the screen goal when outside hold radius", () => {
    const setVelocity = vi.fn();
    const enemy = mockEnemyInstance({
      behavior: "ward",
      defId: "ward",
      speed: 50,
      sprite: {
        x: 0,
        y: 0,
        setVelocity,
        body: { velocity: { x: 0, y: 0 } },
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
      nav: { ...createEnemyNav(), path: [{ x: 84, y: 0 }], pathIndex: 0 },
    });

    wardBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 200,
      playerY: 0,
      deltaMs: 16,
      peerAllies: [{ id: "jav", behavior: "javelineer", x: 0, y: 0 }],
    });

    expect(setVelocity).not.toHaveBeenCalledWith(0, 0);
    expect(setVelocity).toHaveBeenCalled();
  });
});