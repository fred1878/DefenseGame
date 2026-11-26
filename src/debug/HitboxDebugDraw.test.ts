import { describe, expect, it } from "vitest";
import { asScene, fakeScene } from "../test/fakeScene";
import { HitboxDebugDraw } from "./HitboxDebugDraw";

describe("HitboxDebugDraw", () => {
  it("draws every helper and reports a probe hit", () => {
    const scene = fakeScene();
    const draw = new HitboxDebugDraw(asScene(scene));
    const g = scene.made("graphics")[0]!;
    expect(draw.graphics()).toBe(g);
    expect(g.last("setDepth")).toEqual([30]);

    draw.drawCircle(0, 0, 10);
    draw.drawMeleeActivationRange(1, 2, 20);
    draw.drawMeleeMaxRange(1, 2, 30);
    draw.drawObstacleRect(10, 10, 8, 6);
    draw.drawProjectileBody(3, 4, 5);
    draw.drawProjectilePlayerHitTest(3, 4, 8);
    draw.drawProjectileBlastRadius(3, 4, 16);
    draw.drawChargeTouchRadius(0, 0, 12);
    draw.drawChargeDashLine(0, 0, 10, 0);
    draw.drawMeleeArc(0, 0, 0, 40, Math.PI / 4);
    expect(g.callsTo("fillCircle").length).toBeGreaterThan(0);
    expect(g.callsTo("strokeRect").length).toBeGreaterThan(0);
    expect(g.callsTo("strokePath").length).toBeGreaterThan(0);

    expect(
      HitboxDebugDraw.arcWouldHit(0, 0, 0, 40, Math.PI / 2, 20, 0, 4),
    ).toBe(true);
    expect(
      HitboxDebugDraw.arcWouldHit(0, 0, 0, 40, Math.PI / 8, 0, 40, 1),
    ).toBe(false);

    draw.clear();
    expect(g.callsTo("clear").length).toBe(1);
    draw.destroy();
    expect(g.destroyed).toBe(true);
  });
});
