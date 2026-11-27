import { describe, expect, it } from "vitest";
import { asScene, fakeScene } from "../test/fakeScene";
import { mockEnemyInstance } from "../test/testEnemyInstance";
import { PathDebugDraw } from "./PathDebugDraw";
import type { NavGrid } from "../pathfinding/grid";

describe("PathDebugDraw", () => {
  it("draws blocked cells, obstacle rects, and enemy paths", () => {
    const scene = fakeScene();
    const draw = new PathDebugDraw(asScene(scene));
    const g = scene.made("graphics")[0]!;
    expect(draw.graphics()).toBe(g);

    const grid: NavGrid = {
      cellSize: 16,
      cols: 2,
      rows: 2,
      minX: 0,
      minY: 0,
      blocked: [0, 1, 0, 1],
    } as unknown as NavGrid;
    draw.drawObstacleZones(grid, [
      { x: 8, y: 8, w: 16, h: 16, textureKey: "obstacle_tall_rock" },
    ]);
    expect(g.callsTo("fillRect").length).toBe(2);
    expect(g.callsTo("strokeRect").length).toBeGreaterThan(2);

    const withPath = mockEnemyInstance({
      behavior: "meleeChaser",
      sprite: { x: 0, y: 0, setVelocity: () => undefined } as never,
      nav: {
        path: [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        pathIndex: 0,
      } as never,
    });
    draw.drawEnemy(withPath, "wall", 20, 0);
    draw.drawEnemy(
      mockEnemyInstance({
        behavior: "meleeChaser",
        nav: { path: [], pathIndex: 0 } as never,
      }),
      "player",
      4,
      4,
    );
    expect(g.callsTo("strokePath").length).toBe(1);
    expect(g.callsTo("fillCircle").length).toBe(2);

    draw.clear();
    draw.destroy();
    expect(g.destroyed).toBe(true);
  });
});
