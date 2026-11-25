import { describe, expect, it, vi } from "vitest";
import { asScene, fakeScene } from "../test/fakeScene";
import type { VirtualStick } from "../input/VirtualStick";
import { TouchInputDebugDraw } from "./TouchInputDebugDraw";

describe("TouchInputDebugDraw", () => {
  it("draws stick, pointer, hit, and focus flash overlays", () => {
    const scene = fakeScene();
    const hitWithInput = {
      input: {
        hitArea: { x: 0, y: 0, width: 20, height: 10 },
      },
      getWorldTransformMatrix: undefined,
      x: 40,
      y: 50,
      width: 20,
      height: 10,
      originX: 0,
      originY: 0,
      displayOriginX: 0,
      displayOriginY: 0,
      scaleX: 1,
      scaleY: 1,
      parentContainer: null,
    };
    const hitWithBounds = {
      getBounds: () => ({ x: 70, y: 80, width: 12, height: 12 }),
    };
    const hitEmpty = {
      getBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    };
    const hitNoBounds = {};
    scene.input.hitTestPointer = vi.fn(() => [
      hitWithInput,
      hitWithBounds,
      hitEmpty,
      hitNoBounds,
    ]);
    (scene.input as { manager?: { pointers: unknown[] } }).manager = {
      pointers: [
        { isDown: false, x: 0, y: 0, id: 0 },
        { isDown: true, x: 40, y: 50, id: 1 },
        { isDown: true, x: 90, y: 90, id: 2 },
      ],
    };

    const draw = new TouchInputDebugDraw(asScene(scene));
    expect(draw.uiGraphics()).toBe(scene.made("graphics")[0]);
    expect(draw.worldGraphics()).toBe(scene.made("graphics")[1]);
    const screen = scene.made("graphics")[0]!;
    const world = scene.made("graphics")[1]!;

    const stick = {
      getDebugLayout: () => ({
        excludeZones: [{ x: 0, y: 0, width: 10, height: 10 }],
        uiScreenRects: [{ x: 20, y: 20, width: 8, height: 8 }],
        dragThreshold: 12,
        radius: 40,
      }),
      getDebugState: () => ({
        pending: true,
        active: true,
        downX: 15,
        downY: 15,
        originX: 15,
        originY: 15,
        knobX: 25,
        knobY: 15,
      }),
      wouldBlockPointer: (pointer: { id: number }) => pointer.id === 1,
    } as unknown as VirtualStick;

    draw.draw({
      stick,
      pointerUiBlocked: (pointer) => (pointer as { id: number }).id === 2,
      focusFlash: {
        screenX: 100,
        screenY: 80,
        worldX: 5,
        worldY: 6,
        picked: true,
        pickRadiusWorld: 16,
        ageMs: 100,
      },
    });
    expect(screen.callsTo("fillRect").length).toBeGreaterThan(0);
    expect(screen.callsTo("strokeRect").length).toBeGreaterThan(0);
    expect(screen.callsTo("strokeCircle").length).toBeGreaterThan(0);
    expect(screen.callsTo("lineBetween").length).toBeGreaterThan(0);
    expect(world.callsTo("strokeCircle").length).toBe(1);

    // Cover fallbacks: no stick layout, missed flash, unpicked flash.
    draw.draw({
      excludeZones: [],
      uiScreenRects: [],
      focusFlash: {
        screenX: 1,
        screenY: 1,
        worldX: 0,
        worldY: 0,
        picked: false,
        pickRadiusWorld: 8,
        ageMs: 200,
      },
    });
    draw.draw({
      focusFlash: {
        screenX: 0,
        screenY: 0,
        worldX: 0,
        worldY: 0,
        picked: false,
        pickRadiusWorld: 8,
        ageMs: 900,
      },
    });
    draw.clear();
    draw.destroy();
    expect(screen.destroyed).toBe(true);
    expect(world.destroyed).toBe(true);
  });

  it("reads exclude and UI rects from the stick when not provided", () => {
    const scene = fakeScene();
    (scene.input as { manager?: { pointers: unknown[] } }).manager = {
      pointers: [],
    };
    const draw = new TouchInputDebugDraw(asScene(scene));
    const stick = {
      getDebugLayout: () => ({
        excludeZones: [{ x: 1, y: 2, width: 3, height: 4 }],
        uiScreenRects: [{ x: 5, y: 6, width: 7, height: 8 }],
        dragThreshold: 10,
        radius: 20,
      }),
      getDebugState: () => ({
        pending: false,
        active: false,
        downX: 0,
        downY: 0,
        originX: 0,
        originY: 0,
        knobX: 0,
        knobY: 0,
      }),
      wouldBlockPointer: () => false,
    } as unknown as VirtualStick;
    draw.draw({ stick });
    const screen = scene.made("graphics")[0]!;
    expect(screen.callsTo("fillRect")[0]).toEqual([1, 2, 3, 4]);
  });
});
