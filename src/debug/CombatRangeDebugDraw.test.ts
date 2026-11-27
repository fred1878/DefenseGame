import { describe, expect, it, vi } from "vitest";
import { CombatRangeDebugDraw } from "./CombatRangeDebugDraw";

function mockGraphics() {
  const g = {
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillCircle: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fillPath: vi.fn(),
    strokePath: vi.fn(),
    lineTo: vi.fn(),
    destroy: vi.fn(),
  };
  return g;
}

describe("CombatRangeDebugDraw", () => {
  it("draws range helpers and clears", () => {
    const g = mockGraphics();
    const scene = {
      add: {
        graphics: () => ({
          setDepth: () => g,
        }),
      },
    } as unknown as Phaser.Scene;

    const drawer = new CombatRangeDebugDraw(scene);
    drawer.drawMeleeActivationRange(1, 2, 40);
    drawer.drawMeleeMaxRange(1, 2, 60);
    drawer.drawMeleeArc(0, 0, 0, 50, Math.PI / 4);
    drawer.drawChargeDashLine(0, 0, 20, 0);
    drawer.clear();
    expect(g.clear).toHaveBeenCalled();
    drawer.destroy();
    expect(g.destroy).toHaveBeenCalled();
  });

  it("exposes the underlying graphics object", () => {
    const g = mockGraphics();
    const scene = {
      add: {
        graphics: () => ({
          setDepth: () => g,
        }),
      },
    } as unknown as Phaser.Scene;
    const drawer = new CombatRangeDebugDraw(scene);
    expect(drawer.graphics()).toBe(g);
  });
});
