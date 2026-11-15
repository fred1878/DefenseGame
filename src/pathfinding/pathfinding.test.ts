import { describe, expect, it } from "vitest";
import { DEFENSE_MAP, DEFENSE_OBSTACLES, defenseHalfHeight } from "../config";
import { buildNavGrid, cellBlocked, cellToWorldCenter } from "./grid";
import { findPath } from "./astar";
import { hasLineOfSight } from "./los";

describe("nav grid", () => {
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
    const detour = findPath(grid, start.x, start.y, goal.x, goal.y, [
      { x: mid.x, y: mid.y },
    ]);
    const nearMid = (path: ReturnType<typeof findPath>) =>
      path.some((p) => Math.hypot(p.x - mid.x, p.y - mid.y) < 8);
    expect(nearMid(direct)).toBe(true);
    expect(nearMid(detour)).toBe(false);
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
});