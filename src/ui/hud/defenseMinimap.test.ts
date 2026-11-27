import { describe, expect, it, vi } from "vitest";
import { GAME } from "../../config";
import {
  DefenseMinimap,
  defenseMinimapLayout,
  defenseMinimapScreenRect,
  worldToMinimapPoint,
  type DefenseMinimapLayout,
} from "./defenseMinimap";
import type { EnemyInstance } from "../../entities/Enemy";
import { defenseHalfHeight, defenseHalfWidth } from "../../config/defense";

function mockScene(): Phaser.Scene {
  return { scale: { width: GAME.width, height: GAME.height } } as Phaser.Scene;
}

describe("defenseMinimap", () => {
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };
  const scene = mockScene();

  it("layout sits top-right below HUD text block", () => {
    const layout = defenseMinimapLayout(scene, safe);
    expect(layout.x + layout.width).toBeLessThanOrEqual(GAME.width);
    expect(layout.y).toBeGreaterThan(40);
    expect(layout.width).toBeGreaterThan(60);
    expect(layout.height).toBeGreaterThan(layout.width);
  });

  it("maps world corners into the minimap inner area", () => {
    const layout = defenseMinimapLayout(scene, safe);
    const halfW = defenseHalfWidth();
    const halfH = defenseHalfHeight();
    const nw = worldToMinimapPoint(-halfW, -halfH, layout);
    const se = worldToMinimapPoint(halfW, halfH, layout);
    expect(nw.x).toBeGreaterThanOrEqual(layout.x);
    expect(nw.y).toBeGreaterThanOrEqual(layout.y);
    expect(se.x).toBeLessThanOrEqual(layout.x + layout.width);
    expect(se.y).toBeLessThanOrEqual(layout.y + layout.height);
    expect(se.x).toBeGreaterThan(nw.x);
    expect(se.y).toBeGreaterThan(nw.y);
  });

  it("maps world center to map interior", () => {
    const layout: DefenseMinimapLayout = {
      x: 400,
      y: 100,
      width: 80,
      height: 120,
    };
    const pt = worldToMinimapPoint(0, 0, layout);
    expect(pt.x).toBeGreaterThan(layout.x);
    expect(pt.x).toBeLessThan(layout.x + layout.width);
    expect(pt.y).toBeGreaterThan(layout.y);
    expect(pt.y).toBeLessThan(layout.y + layout.height);
  });
});

describe("DefenseMinimap", () => {
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };

  function mockGfx() {
    return {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      clear: vi.fn(),
      destroy: vi.fn(),
      setVisible: vi.fn(),
      lineStyle: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
    };
  }

  it("matches the layout as a screen rect", () => {
    const scene = mockScene();
    const layout = defenseMinimapLayout(scene, safe);
    expect(defenseMinimapScreenRect(scene, safe)).toEqual({
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    });
  });

  it("draws the player and living enemies, then hides and destroys", () => {
    const g = mockGfx();
    const registered: unknown[] = [];
    const scene = {
      registry: { get: () => undefined },
      add: { graphics: () => g },
      scale: { width: GAME.width, height: GAME.height },
    } as unknown as Phaser.Scene;
    const map = new DefenseMinimap(scene, (go) => {
      registered.push(go);
    });
    expect(registered).toEqual([g]);
    const layout: DefenseMinimapLayout = {
      x: 10,
      y: 20,
      width: 80,
      height: 120,
    };
    map.draw(layout, 0, 0, [
      {
        damageable: { alive: true },
        sprite: { x: 10, y: 10 },
      },
      {
        damageable: { alive: false },
        sprite: { x: 20, y: 20 },
      },
    ] as EnemyInstance[]);
    // player + one living enemy
    expect(g.fillCircle).toHaveBeenCalledTimes(2);
    map.setVisible(false);
    expect(g.setVisible).toHaveBeenCalledWith(false);
    map.clear();
    expect(g.clear).toHaveBeenCalled();
    map.destroy();
    expect(g.destroy).toHaveBeenCalled();
  });
});
