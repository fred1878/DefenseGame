import { describe, expect, it } from "vitest";
import { DEFENSE_OBSTACLES, PLAYER_AGGRO_RADIUS } from "../config";
import { buildNavGrid } from "../pathfinding/grid";
import {
  createEnemyNav,
  pickEnemyTarget,
  replanEnemyPath,
  wallTargetPoint,
} from "./EnemyBrain";

describe("pickEnemyTarget", () => {
  const grid = buildNavGrid(DEFENSE_OBSTACLES, 40);

  it("prefers wall when player is far", () => {
    expect(pickEnemyTarget(grid, 200, 0, 0, 0)).toBe("wall");
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

describe("wallTargetPoint", () => {
  it("returns north wall y with enemy x", () => {
    const pt = wallTargetPoint(100, -40);
    expect(pt.x).toBe(100);
    expect(pt.y).toBeLessThan(-40);
  });
});

describe("replanEnemyPath", () => {
  it("produces a non-empty path toward goal", () => {
    const grid = buildNavGrid(DEFENSE_OBSTACLES, 40);
    const nav = createEnemyNav();
    replanEnemyPath(nav, grid, 200, -200, -420, 0);
    expect(nav.path.length).toBeGreaterThan(0);
  });
});