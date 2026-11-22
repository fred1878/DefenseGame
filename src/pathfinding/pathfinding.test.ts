import { describe, expect, it } from "vitest";
import { DEFENSE_MAP, DEFENSE_OBSTACLES, defenseHalfHeight } from "../config";
import {
  enemyCollisionBodyRadius,
  enemyPathClearancePx,
  maxNavObstacleClearancePx,
} from "../entities/entityPhysics";
import { buildNavGrid, cellBlocked, cellSolidBlocked, cellToWorldCenter } from "./grid";
import { findPath } from "./astar";
import { hasLineOfSight } from "./los";

describe("nav grid", () => {
  it("uses static obstacle nav clearance from data", () => {
    expect(DEFENSE_MAP.pathClearancePx).toBe(18);
    expect(DEFENSE_MAP.pathClearancePx).toBe(maxNavObstacleClearancePx());
    expect(enemyPathClearancePx("bruiser")).toBeGreaterThan(
      enemyCollisionBodyRadius("bruiser"),
    );
    expect(enemyPathClearancePx("sentry_archer")).toBeGreaterThan(
      enemyCollisionBodyRadius("sentry_archer"),
    );
  });

  it("marks obstacle cells blocked", () => {
    const grid = buildNavGrid(
      DEFENSE_OBSTACLES,
      DEFENSE_MAP.cellSize,
      DEFENSE_MAP.pathClearancePx,
    );
    expect(cellBlocked(grid, 0, 0)).toBe(false);
    const obs = DEFENSE_OBSTACLES[0]!;
    const col = Math.floor((obs.x - grid.minX) / grid.cellSize);
    const row = Math.floor((obs.y - grid.minY) / grid.cellSize);
    expect(cellBlocked(grid, col, row)).toBe(true);
  });

  it("inflates static obstacles by path clearance", () => {
    const tight = buildNavGrid(DEFENSE_OBSTACLES, DEFENSE_MAP.cellSize, 0);
    const wide = buildNavGrid(
      DEFENSE_OBSTACLES,
      DEFENSE_MAP.cellSize,
      DEFENSE_MAP.pathClearancePx,
    );
    let extra = 0;
    for (let r = 0; r < wide.rows; r++) {
      for (let c = 0; c < wide.cols; c++) {
        if (!cellBlocked(tight, c, r) && cellBlocked(wide, c, r)) extra += 1;
      }
    }
    expect(extra).toBeGreaterThan(0);
  });
});

describe("A*", () => {
  it("does not cut corners on diagonal steps", () => {
    const blocked = new Uint8Array([
      0, 1, 0,
      1, 0, 0,
      0, 0, 0,
    ]);
    const grid = {
      cellSize: 10,
      cols: 3,
      rows: 3,
      minX: 0,
      minY: 0,
      clearancePx: 0,
      blocked,
      solidBlocked: blocked,
    };
    const path = findPath(grid, 5, 5, 25, 25);
    const cutsCorner = path.some(
      (p) => Math.abs(p.x - 15) < 0.01 && Math.abs(p.y - 15) < 0.01,
    );
    expect(cutsCorner).toBe(false);
  });

  it("routes around peer agents occupying the direct corridor", () => {
    const grid = buildNavGrid(
      [],
      DEFENSE_MAP.cellSize,
      DEFENSE_MAP.pathClearancePx,
    );
    const start = cellToWorldCenter(grid, 2, 10);
    const goal = cellToWorldCenter(grid, 18, 10);
    const mid = cellToWorldCenter(grid, 10, 10);
    const direct = findPath(grid, start.x, start.y, goal.x, goal.y);
    const gruntClearance = enemyPathClearancePx("grunt");
    const detour = findPath(
      grid,
      start.x,
      start.y,
      goal.x,
      goal.y,
      [{ x: mid.x, y: mid.y, clearancePx: gruntClearance }],
      gruntClearance,
    );
    const nearMid = (path: ReturnType<typeof findPath>) =>
      path.some((p) => Math.hypot(p.x - mid.x, p.y - mid.y) < 8);
    expect(nearMid(direct)).toBe(true);
    expect(nearMid(detour)).toBe(false);
  });

  it("respects each peer's own clearance radius when detouring", () => {
    const grid = buildNavGrid(
      [],
      DEFENSE_MAP.cellSize,
      DEFENSE_MAP.pathClearancePx,
    );
    const start = cellToWorldCenter(grid, 2, 10);
    const goal = cellToWorldCenter(grid, 18, 10);
    const mid = cellToWorldCenter(grid, 10, 10);
    const gruntClearance = enemyPathClearancePx("grunt");
    const sentryClearance = enemyPathClearancePx("sentry_archer");
    expect(gruntClearance).toBeGreaterThan(sentryClearance);
    const nearMid = (path: ReturnType<typeof findPath>) =>
      path.some((p) => Math.hypot(p.x - mid.x, p.y - mid.y) < 8);
    const widePeerDetour = findPath(
      grid,
      start.x,
      start.y,
      goal.x,
      goal.y,
      [{ x: mid.x, y: mid.y, clearancePx: gruntClearance }],
      gruntClearance,
    );
    const slimPeerDetour = findPath(
      grid,
      start.x,
      start.y,
      goal.x,
      goal.y,
      [{ x: mid.x, y: mid.y, clearancePx: sentryClearance }],
      gruntClearance,
    );
    expect(nearMid(widePeerDetour)).toBe(false);
    expect(slimPeerDetour.length).toBeGreaterThan(0);
    expect(widePeerDetour.length).toBeGreaterThanOrEqual(slimPeerDetour.length);
  });

  it("finds a route around spread obstacles to the north wall", () => {
    const grid = buildNavGrid(
      DEFENSE_OBSTACLES,
      DEFENSE_MAP.cellSize,
      DEFENSE_MAP.pathClearancePx,
    );
    const northY = -defenseHalfHeight() + 40;
    const halfH = defenseHalfHeight();
    const path = findPath(grid, 0, halfH - 180, 0, northY);
    expect(path.length).toBeGreaterThan(1);
    const last = path[path.length - 1]!;
    expect(last.y).toBeLessThan(-200);
  });
});

describe("line of sight", () => {
  it("is blocked when a rock lies between points", () => {
    const grid = buildNavGrid(
      DEFENSE_OBSTACLES,
      DEFENSE_MAP.cellSize,
      DEFENSE_MAP.pathClearancePx,
    );
    const rock = DEFENSE_OBSTACLES[0]!;
    expect(hasLineOfSight(grid, rock.x - 120, rock.y, rock.x + 120, rock.y)).toBe(
      false,
    );
  });

  it("is clear across open ground", () => {
    const grid = buildNavGrid(
      DEFENSE_OBSTACLES,
      DEFENSE_MAP.cellSize,
      DEFENSE_MAP.pathClearancePx,
    );
    const halfH = defenseHalfHeight();
    expect(hasLineOfSight(grid, 0, halfH - 120, 0, halfH - 40)).toBe(true);
  });

  it("is clear when the ray crosses only the nav clearance band", () => {
    const grid = buildNavGrid(
      DEFENSE_OBSTACLES,
      DEFENSE_MAP.cellSize,
      DEFENSE_MAP.pathClearancePx,
    );
    let clearanceCell: { col: number; row: number } | null = null;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (
          cellBlocked(grid, c, r) &&
          !cellSolidBlocked(grid, c, r)
        ) {
          clearanceCell = { col: c, row: r };
          break;
        }
      }
      if (clearanceCell) break;
    }
    expect(clearanceCell).not.toBeNull();
    const player = cellToWorldCenter(grid, clearanceCell!.col, clearanceCell!.row);
    const enemy = { x: player.x + 80, y: player.y };
    expect(hasLineOfSight(grid, enemy.x, enemy.y, player.x, player.y)).toBe(
      true,
    );
  });
});