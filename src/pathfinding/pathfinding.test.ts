import { describe, expect, it } from "vitest";
import { DEFENSE_OBSTACLES, GAME } from "../config";
import { buildNavGrid, cellBlocked } from "./grid";
import { findPath } from "./astar";
import { hasLineOfSight } from "./los";

describe("nav grid", () => {
  it("marks obstacle cells blocked", () => {
    const grid = buildNavGrid(DEFENSE_OBSTACLES, 40);
    expect(cellBlocked(grid, 0, 0)).toBe(false);
    const obs = DEFENSE_OBSTACLES[0]!;
    const col = Math.floor((obs.x - grid.minX) / grid.cellSize);
    const row = Math.floor((obs.y - grid.minY) / grid.cellSize);
    expect(cellBlocked(grid, col, row)).toBe(true);
  });
});

describe("A*", () => {
  it("finds a route around spread obstacles to the north wall", () => {
    const grid = buildNavGrid(DEFENSE_OBSTACLES, 40);
    const northY = -GAME.worldHalfSize + 40;
    const path = findPath(grid, 200, -200, 200, northY);
    expect(path.length).toBeGreaterThan(1);
    const last = path[path.length - 1]!;
    expect(last.y).toBeLessThan(-200);
  });
});

describe("line of sight", () => {
  it("is blocked when a rock lies between points", () => {
    const grid = buildNavGrid(DEFENSE_OBSTACLES, 40);
    const rock = DEFENSE_OBSTACLES[0]!;
    expect(hasLineOfSight(grid, rock.x - 120, rock.y, rock.x + 120, rock.y)).toBe(
      false,
    );
  });

  it("is clear across open ground", () => {
    const grid = buildNavGrid(DEFENSE_OBSTACLES, 40);
    expect(hasLineOfSight(grid, 0, 0, 100, 50)).toBe(true);
  });
});