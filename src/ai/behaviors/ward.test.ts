import { describe, expect, it, vi } from "vitest";
import { createEnemyNav } from "../brainShared";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import type { EnemyBehaviorExtra } from "../../entities/Enemy";
import { updateEnemyCombat } from "../../entities/EnemyCombat";
import {
  evaluateWardPostHold,
  pickWardProtectee,
  slewWardHoldFacing,
  wardBehavior,
  wardPostHoldBroken,
  wardScreenPoint,
} from "./ward";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";

const SHIPPED_WARD = shippedEnemyCombat("ward").ward!;
const WARD_POST_BREAK_MOVE_PX = SHIPPED_WARD.postBreakMoveWu!;
const WARD_POST_GRACE_MS = SHIPPED_WARD.postGraceMs!;
const WARD_POST_FACING_SLACK_RAD =
  (SHIPPED_WARD.postFacingSlackDeg! * Math.PI) / 180;

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
    chargeHitThisDash: false,
    wardPostGraceMs: 0,
    wardPostSnapPlayerX: 0,
    wardPostSnapPlayerY: 0,
    wardPostSnapAllyX: 0,
    wardPostSnapAllyY: 0,
    wardPostAnchorGoalX: 0,
    wardPostAnchorGoalY: 0,
    wardPostWasInHoldRadius: false,
    wardPostHolding: false,
  };
}

describe("ward behavior helpers", () => {
  it("picks the nearest ranged ally within protect radius", () => {
    const allies = [
      { id: "a", behavior: "meleeChaser", defId: "grunt", x: 50, y: 0 },
      { id: "b", behavior: "javelineer", defId: "javelineer", x: 80, y: 0 },
      {
        id: "c",
        behavior: "arrowRainArcher",
        defId: "arrow_rain_archer",
        x: 120,
        y: 0,
      },
    ];
    const pick = pickWardProtectee(allies, 0, 0, 200);
    expect(pick?.id).toBe("b");
  });

  it("places screen point at a fixed offset from ally toward player", () => {
    const reg = {
      get: () => undefined,
    } as unknown as import("phaser").Data.DataManager;
    const offsetWu = 40;
    const p = wardScreenPoint(100, 0, 0, 0, offsetWu, reg);
    expect(p.x).toBe(offsetWu);
    expect(p.y).toBe(0);
  });

  it("keeps slot distance fixed when the player is farther away", () => {
    const reg = {
      get: () => undefined,
    } as unknown as import("phaser").Data.DataManager;
    const offsetWu = 40;
    const near = wardScreenPoint(100, 0, 0, 0, offsetWu, reg);
    const far = wardScreenPoint(300, 0, 0, 0, offsetWu, reg);
    expect(Math.hypot(near.x, near.y)).toBe(offsetWu);
    expect(Math.hypot(far.x, far.y)).toBe(offsetWu);
    expect(far.x).toBe(near.x);
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
      WARD_POST_GRACE_MS,
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
      WARD_POST_GRACE_MS,
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
      WARD_POST_GRACE_MS,
    );
    expect(decision.hold).toBe(true);
    expect(
      wardPostHoldBroken(extra, 110, 3, 0, 0, WARD_POST_BREAK_MOVE_PX, true),
    ).toBe(false);
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
      WARD_POST_GRACE_MS,
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
      WARD_POST_GRACE_MS,
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
      WARD_POST_GRACE_MS,
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
      WARD_POST_GRACE_MS,
    );
    expect(decision.hold).toBe(false);
  });

  it("keeps holding after grace when snap and goal are stable", () => {
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
      WARD_POST_GRACE_MS,
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
      WARD_POST_GRACE_MS,
    );
    expect(decision.hold).toBe(true);
    expect(decision.skipReplan).toBe(true);
    expect(extra.wardPostGraceMs).toBe(0);
  });
});

describe("slewWardHoldFacing", () => {
  it("keeps current facing inside slack", () => {
    const current = 0;
    const target = WARD_POST_FACING_SLACK_RAD * 0.5;
    expect(
      slewWardHoldFacing(current, target, WARD_POST_FACING_SLACK_RAD),
    ).toBe(current);
  });

  it("snaps to target beyond slack", () => {
    const current = 0;
    const target = Math.PI / 2;
    expect(
      slewWardHoldFacing(current, target, WARD_POST_FACING_SLACK_RAD),
    ).toBeCloseTo(target, 5);
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
      peerAllies: [
        { id: "jav", behavior: "javelineer", defId: "javelineer", x: 0, y: 0 },
      ],
    });

    expect(setVelocity).toHaveBeenCalled();
    const last = setVelocity.mock.calls.at(-1);
    expect(last?.[0]).toBe(0);
    expect(last?.[1]).toBe(0);
    expect(enemy.behaviorExtra.wardPostHolding).toBe(true);
    expect(enemy.combat.facing).toBeCloseTo(Math.atan2(0 - 1, 200 - 83), 4);
  });

  it("does not flip facing toward wall combat target while holding", () => {
    const setVelocity = vi.fn();
    const enemy = mockEnemyInstance({
      behavior: "ward",
      defId: "ward",
      sprite: {
        x: 83,
        y: 1,
        setVelocity,
        body: { velocity: { x: 0, y: 0 } },
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
      nav: { ...createEnemyNav(), path: [{ x: 83, y: 1 }], pathIndex: 1 },
    });
    const towardPlayer = Math.atan2(0 - 1, 200 - 83);
    enemy.combat.facing = towardPlayer;

    wardBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 200,
      playerY: 0,
      deltaMs: 16,
      peerAllies: [
        { id: "jav", behavior: "javelineer", defId: "javelineer", x: 0, y: 0 },
      ],
    });

    const idleTarget = {
      kind: "player" as const,
      x: 600,
      y: 400,
      radius: 16,
      damageable: {
        id: "player",
        team: "player" as const,
        alive: true,
        hp: 100,
        maxHp: 100,
      },
    };
    updateEnemyCombat(enemy, idleTarget, 16);
    expect(enemy.combat.facing).toBeCloseTo(towardPlayer, 4);
  });

  it("keeps hold and slack facing when the screen goal jitters", () => {
    const setVelocity = vi.fn();
    const enemy = mockEnemyInstance({
      behavior: "ward",
      defId: "ward",
      sprite: {
        x: 83,
        y: 1,
        setVelocity,
        body: { velocity: { x: 0, y: 0 } },
        scene: { registry: { get: () => undefined } },
      } as unknown as import("../../entities/Enemy").EnemyInstance["sprite"],
      nav: { ...createEnemyNav(), path: [{ x: 83, y: 1 }], pathIndex: 1 },
    });
    const ally = {
      id: "jav",
      behavior: "javelineer" as const,
      defId: "javelineer",
      x: 0,
      y: 0,
    };
    const ctx = {
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 200,
      playerY: 0,
      deltaMs: 16,
      peerAllies: [ally],
    };
    wardBehavior(ctx);
    const facing0 = enemy.combat.facing;
    expect(enemy.behaviorExtra.wardPostHolding).toBe(true);

    ctx.playerX = 205;
    ctx.playerY = 2;
    ally.x = 1;
    wardBehavior(ctx);
    expect(enemy.behaviorExtra.wardPostHolding).toBe(true);
    expect(setVelocity.mock.calls.at(-1)).toEqual([0, 0]);
    expect(enemy.combat.facing).toBeCloseTo(facing0, 4);
  });

  it("paths toward the screen goal when outside hold radius", () => {
    const setVelocity = vi.fn();
    const enemy = mockEnemyInstance({
      behavior: "ward",
      defId: "ward",
      speedWu: 50,
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
      peerAllies: [
        { id: "jav", behavior: "javelineer", defId: "javelineer", x: 0, y: 0 },
      ],
    });

    expect(setVelocity).not.toHaveBeenCalledWith(0, 0);
    expect(setVelocity).toHaveBeenCalled();
  });

  it("uses the default aggro radius and follows a path with no protectee", () => {
    const setVelocity = vi.fn();
    const enemy = mockEnemyInstance({
      behavior: "ward",
      defId: "ward",
      speedWu: 50,
      sprite: {
        x: 0,
        y: 0,
        setVelocity,
        body: { velocity: { x: 0, y: 0 } },
        scene: { registry: { get: () => undefined } },
      } as never,
    });
    const ward = enemy.combatTuning.ward;
    if (ward && "playerAggroRadiusWu" in ward) {
      delete (ward as { playerAggroRadiusWu?: number }).playerAggroRadiusWu;
    }
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "wall",
      path: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
      ],
      pathIndex: 0,
      replanMs: 1000,
    };
    wardBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 400,
      playerY: 400,
      deltaMs: 16,
    });
    expect(enemy.nav.pathIndex).toBe(1);
    expect(setVelocity).toHaveBeenCalled();
    const [vx] = setVelocity.mock.calls.at(-1)!;
    expect(vx).toBeGreaterThan(0);
  });
});

describe("ward helper edge cases", () => {
  it("wraps facing deltas across the ±π boundary", () => {
    const slack = WARD_POST_FACING_SLACK_RAD;
    expect(slewWardHoldFacing(0, Math.PI * 3, slack)).toBeCloseTo(Math.PI, 6);
    expect(slewWardHoldFacing(0, -Math.PI * 3, slack)).toBeCloseTo(-Math.PI, 6);
  });

  it("returns no protectee when allies are missing or not ranged", () => {
    expect(pickWardProtectee(undefined, 0, 0, 200)).toBeUndefined();
    expect(pickWardProtectee([], 0, 0, 200)).toBeUndefined();
    expect(
      pickWardProtectee(
        [{ id: "g", behavior: "meleeChaser", defId: "grunt", x: 0, y: 0 }],
        0,
        0,
        200,
      ),
    ).toBeUndefined();
  });

  it("sits on the ally when the player is stacked on them", () => {
    const reg = { get: () => undefined } as never;
    expect(wardScreenPoint(4, 4, 4, 4, 40, reg)).toEqual({ x: 4, y: 4 });
  });

  it("drops hold after grace when the post goal drifts", () => {
    const extra = freshWardExtra();
    evaluateWardPostHold(
      extra,
      16,
      true,
      0,
      0,
      10,
      0,
      0,
      80,
      WARD_POST_BREAK_MOVE_PX,
      WARD_POST_GRACE_MS,
    );
    evaluateWardPostHold(
      extra,
      WARD_POST_GRACE_MS,
      true,
      0,
      0,
      10,
      0,
      0,
      80,
      WARD_POST_BREAK_MOVE_PX,
      WARD_POST_GRACE_MS,
    );
    const dropped = evaluateWardPostHold(
      extra,
      16,
      true,
      200,
      0,
      10,
      0,
      0,
      80,
      WARD_POST_BREAK_MOVE_PX,
      WARD_POST_GRACE_MS,
    );
    expect(dropped).toEqual({
      hold: false,
      skipReplan: false,
      snapFacing: false,
    });
  });
});
