import { describe, expect, it } from "vitest";
import { GAME } from "../config";
import {
  defenseMinimapLayout,
  worldToMinimapPoint,
  type DefenseMinimapLayout,
} from "./defenseMinimap";
import { defenseHalfHeight, defenseHalfWidth } from "../config/defense";

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