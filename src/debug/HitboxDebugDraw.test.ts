import { describe, expect, it } from "vitest";
import { emitGameEvent } from "../core/gameEvents";
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

  it("fades recorded spell hit areas and refreshes them on each tick", () => {
    const scene = fakeScene();
    const draw = new HitboxDebugDraw(asScene(scene));
    const g = scene.made("graphics")[0]!;

    emitGameEvent("spellHitArea", { kind: "disk", x: 10, y: 20, radius: 30 });
    draw.drawSpellHitAreas(0);
    expect(g.last("fillCircle")).toEqual([10, 20, 30]);
    const fullAlpha = g.last("fillStyle")![1] as number;
    expect(fullAlpha).toBeGreaterThan(0);

    // One frame later the area is still fresh; after 110 ms it has faded by half.
    draw.drawSpellHitAreas(0);
    expect(g.last("fillStyle")![1]).toBeCloseTo(fullAlpha, 6);
    draw.drawSpellHitAreas(110);
    draw.drawSpellHitAreas(110);
    expect(g.last("fillStyle")![1]).toBeCloseTo(fullAlpha / 2, 5);

    // Fully faded: nothing is redrawn without a new tick.
    const drawnBefore = g.callsTo("fillCircle").length;
    draw.drawSpellHitAreas(16);
    expect(g.callsTo("fillCircle").length).toBe(drawnBefore);

    emitGameEvent("spellHitArea", {
      kind: "wedge",
      x: 0,
      y: 0,
      facing: 0,
      range: 40,
      halfArc: Math.PI / 4,
    });
    draw.drawSpellHitAreas(0);
    expect(g.callsTo("arc").length).toBeGreaterThan(0);

    draw.clearSpellHits();
    const cleared = g.callsTo("arc").length;
    draw.drawSpellHitAreas(0);
    expect(g.callsTo("arc").length).toBe(cleared);
    draw.destroy();
    expect(g.destroyed).toBe(true);
  });
});
