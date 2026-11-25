import { describe, expect, it, vi, afterEach } from "vitest";
import type Phaser from "phaser";
import {
  pointInScreenRects,
  VirtualStick,
  type VirtualStickOptions,
} from "./VirtualStick";
import { STICK_POST_DRAG_TAP_SUPPRESS_MS } from "./inputTuning";

describe("pointInScreenRects", () => {
  const rects = [
    { x: 0, y: 0, width: 100, height: 50 },
    { x: 400, y: 1000, width: 140, height: 200 },
  ];

  it("blocks points inside HUD band", () => {
    expect(pointInScreenRects(12, 24, rects)).toBe(true);
  });

  it("blocks right cluster", () => {
    expect(pointInScreenRects(450, 1100, rects)).toBe(true);
  });

  it("allows open playfield", () => {
    expect(pointInScreenRects(200, 600, rects)).toBe(false);
  });
});

type HarnessPointer = { id: number; x: number; y: number };

function makeMockArc() {
  const arc = {
    x: 0,
    y: 0,
    visible: false,
    setScrollFactor() {
      return arc;
    },
    setDepth() {
      return arc;
    },
    setVisible(v: boolean) {
      arc.visible = v;
      return arc;
    },
    setPosition(x: number, y: number) {
      arc.x = x;
      arc.y = y;
      return arc;
    },
    destroy() {},
  };
  return arc;
}

function makeStickHarness(options?: Partial<VirtualStickOptions>) {
  const handlers: Record<string, ((p: HarnessPointer) => void)[]> = {};
  const scene = {
    add: {
      circle: () => makeMockArc(),
    },
    input: {
      on(event: string, fn: (p: HarnessPointer) => void, context?: unknown) {
        const call = (p: HarnessPointer) => {
          if (context !== undefined) fn.call(context, p);
          else fn(p);
        };
        handlers[event] ??= [];
        handlers[event].push(call);
      },
      off() {},
      hitTestPointer: () => [] as unknown[],
    },
  };
  const stick = new VirtualStick(scene as unknown as Phaser.Scene, {
    dragThresholdPx: 10,
    radius: 50,
    ...options,
  });
  const pt = (id: number, x: number, y: number): HarnessPointer => ({
    id,
    x,
    y,
  });
  const emit = (event: string, p: HarnessPointer) => {
    for (const fn of handlers[event] ?? []) fn(p);
  };
  return {
    stick,
    down: (x: number, y: number, id = 1) => emit("pointerdown", pt(id, x, y)),
    move: (x: number, y: number, id = 1) => emit("pointermove", pt(id, x, y)),
    up: (x: number, y: number, id = 1) => emit("pointerup", pt(id, x, y)),
    pointer: (id: number, x: number, y: number) => pt(id, x, y),
  };
}

describe("VirtualStick gesture FSM", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not activate stick movement below drag threshold", () => {
    const { stick, down, move } = makeStickHarness();
    down(100, 400);
    move(108, 405);
    const state = stick.getDebugState();
    expect(state.active).toBe(false);
    expect(stick.getDirection().x).toBe(0);
    expect(stick.getDirection().y).toBe(0);
  });

  it("classifies a long movement as drag and normalizes direction", () => {
    const { stick, down, move } = makeStickHarness();
    down(200, 600);
    move(260, 600);
    expect(stick.getDebugState().active).toBe(true);
    const dir = stick.getDirection();
    expect(dir.x).toBeCloseTo(1);
    expect(dir.y).toBeCloseTo(0);
  });

  it("records a tap when released without crossing threshold", () => {
    const { stick, down, up, pointer } = makeStickHarness();
    down(120, 300);
    up(123, 305);
    const tap = stick.tryConsumeTap(
      pointer(1, 123, 305) as unknown as Phaser.Input.Pointer,
    );
    expect(tap).toEqual({ kind: "tap", x: 123, y: 305 });
  });

  it("suppresses tap after stick drag release for a short window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const { stick, down, move, up, pointer } = makeStickHarness();
    down(200, 500);
    move(250, 500);
    up(250, 500);
    const during = stick.tryConsumeTap(
      pointer(1, 250, 500) as unknown as Phaser.Input.Pointer,
    );
    expect(during).toEqual({ kind: "drag" });
    vi.advanceTimersByTime(STICK_POST_DRAG_TAP_SUPPRESS_MS + 1);
    expect(
      stick.tryConsumeTap(
        pointer(1, 250, 500) as unknown as Phaser.Input.Pointer,
      ),
    ).toEqual({ kind: "none" });
  });

  it("clears active state on pointer up (cancel touch)", () => {
    const { stick, down, move, up } = makeStickHarness();
    down(80, 80);
    move(200, 200);
    up(200, 200);
    expect(stick.getDebugState().active).toBe(false);
    expect(stick.getDirection().x).toBe(0);
  });

  it("blocks stick start when externalBlock is set", () => {
    const { stick, down } = makeStickHarness();
    stick.setExternalBlock(() => true);
    down(200, 600);
    expect(stick.getDebugState().pointerId).toBe(null);
    stick.setExternalBlock(null);
    down(200, 600);
    expect(stick.getDebugState().pointerId).toBe(1);
  });

  it("blocks stick start inside configured uiScreenRects", () => {
    const { stick, down } = makeStickHarness({
      uiScreenRects: [{ x: 0, y: 0, width: 120, height: 120 }],
    });
    down(40, 40);
    expect(stick.getDebugState().pointerId).toBe(null);
  });

  it("uses e2e override direction until cleared", () => {
    const { stick } = makeStickHarness();
    stick.setE2eOverride(0, -1);
    expect(stick.getDirection().y).toBeCloseTo(-1);
    stick.setE2eOverride(0, 0);
    expect(stick.getDirection().x).toBe(0);
    expect(stick.getDirection().y).toBe(0);
  });
});
