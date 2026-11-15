import { describe, expect, it } from "vitest";
import {
  DEFENSE_OBSTACLES,
  PLAYER_AGGRO_RADIUS,
  PLAYER_CHASE_MEMORY_MS,
  WALL_VELOCITY_BLEND_MS,
} from "../config";
import {
  DEFENSE_MAP,
  northWallApproachY,
  northWallAttackY,
} from "../config/defense";
import { buildNavGrid } from "../pathfinding/grid";
import {
  createEnemyNav,
  pickEnemyTarget,
  replanEnemyPath,
  resolveEnemyTarget,
  wallTargetPoint,
} from "./EnemyBrain";

describe("pickEnemyTarget", () => {
  const grid = buildNavGrid(DEFENSE_OBSTACLES, 16, DEFENSE_MAP.pathClearancePx);

  it("prefers wall when player is far", () => {
    expect(pickEnemyTarget(grid, 400, 0, 0, 0)).toBe("wall");
    expect(PLAYER_AGGRO_RADIUS).toBeGreaterThan(300);
  });

  it("aggros player when close and LOS is clear", () => {
    expect(pickEnemyTarget(grid, 40, 0, 0, 0)).toBe("player");
    expect(PLAYER_AGGRO_RADIUS).toBeGreaterThan(30);
  });

  it("targets wall when rock blocks LOS even if close", () => {
    const rock = DEFENSE_OBSTACLES[0]!;
    const ex = rock.x - 30;
    const ey = rock.y;
    const px = rock.x + 30;
    const py = rock.y;
    expect(pickEnemyTarget(grid, ex, ey, px, py)).toBe("wall");
  });
});

describe("resolveEnemyTarget", () => {
  const grid = buildNavGrid(DEFENSE_OBSTACLES, 16, DEFENSE_MAP.pathClearancePx);

  it("continues toward last known position after LOS breaks", () => {
    const nav = createEnemyNav();
    resolveEnemyTarget(nav, grid, 40, 0, 0, 0, 16);
    expect(nav.targetKind).toBe("player");
    expect(nav.chaseMemoryMs).toBe(PLAYER_CHASE_MEMORY_MS);

    const px = 500;
    const py = 200;
    const r = resolveEnemyTarget(nav, grid, 40, 0, px, py, 16);
    expect(r.targetKind).toBe("player");
    expect(r.goalX).toBe(0);
    expect(r.goalY).toBe(0);
    expect(nav.chaseMemoryMs).toBeLessThan(PLAYER_CHASE_MEMORY_MS);
    expect(nav.chaseMemoryMs).toBeGreaterThan(0);
  });

  it("combat target is wall while chase memory still pursues last known player", () => {
    const nav = createEnemyNav();
    nav.lastKnownPlayerX = 120;
    nav.lastKnownPlayerY = 80;
    nav.chaseMemoryMs = PLAYER_CHASE_MEMORY_MS;
    nav.targetKind = "player";

    const wy = northWallAttackY();
    expect(pickEnemyTarget(grid, 0, wy + 24, 400, 300)).toBe("wall");
    expect(nav.targetKind).toBe("player");
    expect(nav.chaseMemoryMs).toBeGreaterThan(0);
  });

  it("starts wall velocity blend when chase memory expires", () => {
    const nav = createEnemyNav();
    nav.targetKind = "player";
    nav.lastKnownPlayerX = 80;
    nav.lastKnownPlayerY = 40;
    nav.chaseMemoryMs = 50;

    const r = resolveEnemyTarget(nav, grid, 400, 0, 0, 0, 100);
    expect(r.targetKind).toBe("wall");
    expect(nav.chaseMemoryMs).toBe(0);
    expect(nav.wallTransitionMs).toBe(WALL_VELOCITY_BLEND_MS);
  });
});

describe("wallTargetPoint", () => {
  it("returns approach line south of the wall with enemy x", () => {
    const pt = wallTargetPoint(100, -40);
    expect(pt.x).toBe(100);
    expect(pt.y).toBe(northWallApproachY());
    expect(pt.y).toBeGreaterThan(northWallAttackY());
  });
});

describe("replanEnemyPath", () => {
  it("produces a non-empty path toward goal", () => {
    const grid = buildNavGrid(DEFENSE_OBSTACLES, 16, DEFENSE_MAP.pathClearancePx);
    const nav = createEnemyNav();
    replanEnemyPath(nav, grid, 0, 400, 0, -500);
    expect(nav.path.length).toBeGreaterThan(0);
  });
});