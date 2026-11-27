import { maxNavObstacleClearancePx } from "../../entities/entityPhysics";
import { describe, expect, it, vi } from "vitest";
import { DEFENSE_MAP } from "../../config";
import { buildNavGrid, cellToWorldCenter } from "../../pathfinding/grid";
import { hasLineOfSight } from "../../pathfinding/los";
import { createEnemyNav } from "../brainShared";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { meleeChaserBehavior } from "./meleeChaser";
import { wallMeleeStandoffY } from "./movement";
import { shouldMeleeLosShortcutToPlayer } from "./movement";

describe("meleeChaserBehavior", () => {
  const openGrid = {
    blocked: () => false,
    width: 1,
    height: 1,
    cellSize: 40,
  } as unknown as import("../../pathfinding/grid").NavGrid;

  it("allows LOS cut-in only after the path is exhausted", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    const nav = {
      ...createEnemyNav(),
      path: [{ x: -20, y: 0 }],
      pathIndex: 1,
      pathGoalReached: true,
    };
    expect(shouldMeleeLosShortcutToPlayer(enemy, nav, 0, 0)).toBe(true);
    expect(
      shouldMeleeLosShortcutToPlayer(enemy, { ...nav, pathIndex: 0 }, 0, 0),
    ).toBe(false);
    expect(
      shouldMeleeLosShortcutToPlayer(
        enemy,
        { ...nav, pathGoalReached: false },
        0,
        0,
      ),
    ).toBe(false);
  });

  it("follows path waypoints when a closer ally blocks the player chord", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [{ x: -35, y: 70 }],
      pathIndex: 0,
      replanMs: 5000,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: -25,
          y: 0,
        },
      ],
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(Math.hypot(vx, vy)).toBeGreaterThan(0);
    expect(vy).toBeGreaterThan(0);
  });

  it("holds after path exhaustion when chord is blocked", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    const slot = { x: -35, y: 70 };
    enemy.sprite.x = slot.x;
    enemy.sprite.y = slot.y;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [slot],
      pathIndex: 1,
      replanMs: 5000,
      pathGoalReached: false,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: -25,
          y: 0,
        },
      ],
    });
    expect(setVelocity).toHaveBeenCalledWith(0, 0);
  });

  it("follows the last path leg when chord blocked", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [
        { x: -35, y: 70 },
        { x: -10, y: 80 },
      ],
      pathIndex: 1,
      replanMs: 5000,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: -25,
          y: 0,
        },
      ],
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(Math.hypot(vx, vy)).toBeGreaterThan(0);
    expect(vy).toBeGreaterThan(0);
  });

  it("does not LOS-bite when a front ally sits ahead on a flanking line", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 60;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [{ x: -35, y: 70 }],
      pathIndex: 0,
      replanMs: 5000,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: -18,
          y: 0,
        },
      ],
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(vy).toBeGreaterThan(0);
    expect(vx).toBeGreaterThan(0);
    expect(Math.hypot(vx, vy)).toBeGreaterThan(0);
  });

  it("does not LOS-bite while a multi-step path still has waypoints", () => {
    const grid = buildNavGrid(
      [],
      DEFENSE_MAP.cellSize,
      maxNavObstacleClearancePx(),
    );
    const player = cellToWorldCenter(grid, 10, 10);
    const flank = cellToWorldCenter(grid, 2, 10);
    expect(hasLineOfSight(grid, flank.x, flank.y, player.x, player.y)).toBe(
      true,
    );
    const waypoint = cellToWorldCenter(grid, 6, 6);

    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = flank.x;
    enemy.sprite.y = flank.y;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [waypoint, cellToWorldCenter(grid, 8, 8)],
      pathIndex: 0,
      replanMs: 5000,
      pathGoalReached: true,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid,
      playerX: player.x,
      playerY: player.y,
      deltaMs: 16,
      objective: "huntPlayer",
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(Math.hypot(vx, vy)).toBeGreaterThan(0);
    const moveAngle = Math.atan2(vy, vx);
    const towardWp = Math.atan2(waypoint.y - flank.y, waypoint.x - flank.x);
    expect(
      Math.abs(
        Math.atan2(
          Math.sin(moveAngle - towardWp),
          Math.cos(moveAngle - towardWp),
        ),
      ),
    ).toBeLessThan(0.2);
  });

  it("does not LOS-bite toward player center after a small player offset when unreachable", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    const flankSlot = { x: -100, y: -15 };
    enemy.sprite.x = flankSlot.x;
    enemy.sprite.y = flankSlot.y;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [flankSlot],
      pathIndex: 1,
      replanMs: 5000,
      pathGoalReached: false,
      meleePackAnchorX: 0,
      meleePackAnchorY: 0,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 10,
      playerY: -6,
      deltaMs: 16,
      objective: "huntPlayer",
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    expect(Math.hypot(vx, vy)).toBe(0);
  });

  it("steers to flank slot instead of player center when path goal is unreachable", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = -100;
    enemy.sprite.y = 40;
    const flankSlot = { x: -100, y: -15 };
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [flankSlot],
      pathIndex: 0,
      replanMs: 5000,
      pathGoalReached: false,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 0,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
    });
    const [vx, vy] = setVelocity.mock.calls.at(-1)!;
    const speed = Math.hypot(vx, vy);
    const moveAngle = Math.atan2(vy, vx);
    const towardSlot = Math.atan2(-55, 0);
    expect(speed).toBeGreaterThan(0);
    expect(Math.abs(vx)).toBeLessThan(Math.abs(vy));
    expect(vy).toBeLessThan(0);
    expect(
      Math.abs(
        Math.atan2(
          Math.sin(moveAngle - towardSlot),
          Math.cos(moveAngle - towardSlot),
        ),
      ),
    ).toBeLessThan(0.2);
  });

  it("advances to the next path waypoint when starting on the current one", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
      ],
      pathIndex: 0,
      replanMs: 5000,
      pathGoalReached: false,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 200,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
      peerAllies: [
        {
          id: "front",
          behavior: "meleeChaser",
          defId: "grunt",
          x: 40,
          y: 0,
        },
      ],
    });
    expect(enemy.nav.pathIndex).toBe(1);
    const [vx] = setVelocity.mock.calls.at(-1)!;
    expect(vx).toBeGreaterThan(0);
  });

  it("cuts in toward the player once the path is exhausted and the chord is clear", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "player",
      path: [{ x: 0, y: 0 }],
      pathIndex: 1,
      replanMs: 5000,
      pathGoalReached: true,
    };
    const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 200,
      playerY: 0,
      deltaMs: 16,
      objective: "huntPlayer",
    });
    const [vx] = setVelocity.mock.calls.at(-1)!;
    expect(vx).toBeGreaterThan(0);
  });

  it("leaves a spent waypoint without a next one", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
      speedWu: 80,
    });
    enemy.sprite.x = 0;
    enemy.sprite.y = 0;
    enemy.nav = {
      ...createEnemyNav(),
      targetKind: "wall",
      path: [{ x: 0, y: 0 }],
      pathIndex: 0,
      replanMs: 5000,
      pathGoalReached: false,
    };
    meleeChaserBehavior({
      enemy,
      nav: enemy.nav,
      grid: openGrid,
      playerX: 10_000,
      playerY: 10_000,
      deltaMs: 16,
    });
    expect(enemy.nav.pathIndex).toBe(1);
  });
});

it("holds at the wall when the player is far away", () => {
  const navGrid = buildNavGrid(
    [],
    DEFENSE_MAP.cellSize,
    maxNavObstacleClearancePx(),
  );
  const enemy = mockEnemyInstance({
    behavior: "meleeChaser",
    defId: "grunt",
    sprite: {
      x: 200,
      y: 0,
      setVelocity: vi.fn(),
      scene: { registry: { get: () => undefined } },
    } as never,
  });
  enemy.sprite.y = wallMeleeStandoffY(enemy);
  const setVelocity = enemy.sprite.setVelocity as ReturnType<typeof vi.fn>;
  setVelocity.mockClear();
  const result = meleeChaserBehavior({
    enemy,
    nav: { ...createEnemyNav(), targetKind: "wall", replanMs: 0 },
    grid: navGrid,
    playerX: 10_000,
    playerY: 10_000,
    deltaMs: 16,
  });
  expect(result.targetKind).toBe("wall");
  expect(setVelocity).toHaveBeenCalledWith(0, 0);
});
