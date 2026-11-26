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

function makeStickHarness(
  options?: Partial<VirtualStickOptions>,
  extras?: { hitTestPointer?: () => unknown[] },
) {
  const handlers: Record<string, ((p: HarnessPointer) => void)[]> = {};
  const offs: Array<[string, unknown, unknown]> = [];
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
      off(event: string, fn: unknown, context?: unknown) {
        offs.push([event, fn, context]);
      },
      hitTestPointer: extras?.hitTestPointer ?? (() => [] as unknown[]),
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

describe("VirtualStick remaining input branches", () => {
  it("uses default radius and drag threshold when omitted", () => {
    const handlers: Record<
      string,
      ((p: { id: number; x: number; y: number }) => void)[]
    > = {};
    const scene = {
      add: { circle: () => makeMockArc() },
      input: {
        on(
          event: string,
          fn: (p: { id: number; x: number; y: number }) => void,
          ctx?: unknown,
        ) {
          const call = (p: { id: number; x: number; y: number }) =>
            ctx !== undefined ? fn.call(ctx, p) : fn(p);
          let list = handlers[event];
          if (!list) {
            list = [];
            handlers[event] = list;
          }
          list.push(call);
        },
        off() {},
        hitTestPointer: () => [],
      },
    };
    const bare = new VirtualStick(scene as unknown as Phaser.Scene);
    const layout = bare.getDebugLayout();
    expect(layout.radius).toBe(56);
    expect(layout.dragThreshold).toBe(16);
  });

  it("updates an existing e2e override and reports debug layout helpers", () => {
    const drawn: unknown[] = [];
    const { stick, down, move, up, pointer } = makeStickHarness({
      registerUiDraw: (go) => {
        drawn.push(go);
      },
    });
    expect(drawn.length).toBe(2);
    stick.setE2eOverride(1, 0);
    stick.setE2eOverride(0, 1);
    expect(stick.getDirection().y).toBeCloseTo(1);

    stick.setUiScreenRects([{ x: 0, y: 0, width: 10, height: 10 }]);
    stick.setBlockers([{} as Phaser.GameObjects.GameObject]);
    expect(stick.getDebugLayout().uiScreenRects).toHaveLength(1);
    expect(
      stick.wouldBlockPointer(
        pointer(1, 2, 2) as unknown as Phaser.Input.Pointer,
      ),
    ).toBe(true);

    down(200, 200, 1);
    down(400, 400, 2); // second pointer ignored
    move(205, 200, 2); // wrong id ignored
    up(205, 200, 2);
    expect(stick.getDebugState().pointerId).toBe(1);
    move(200, 200, 1); // still pending, at origin
    move(280, 200, 1);
    move(200, 200, 1); // active but length 0
    expect(stick.getDebugState().active).toBe(true);
    expect(stick.getDirection().x).toBe(0);
    up(200, 200, 1);
  });

  it("treats an expired drag-end window as no tap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    const { stick, down, move, up, pointer } = makeStickHarness();
    down(10, 10);
    move(80, 10);
    up(80, 10);
    vi.advanceTimersByTime(STICK_POST_DRAG_TAP_SUPPRESS_MS + 5);
    expect(
      stick.tryConsumeTap(
        pointer(1, 80, 10) as unknown as Phaser.Input.Pointer,
      ),
    ).toEqual({ kind: "none" });
    vi.useRealTimers();
  });

  it("blocks start in exclude zones and over interactive UI or blockers", () => {
    const { stick: excluded, down: downEx } = makeStickHarness({
      excludeZones: [{ x: 0, y: 0, width: 50, height: 50 }],
    });
    downEx(10, 10);
    expect(excluded.getDebugState().pointerId).toBe(null);

    const interactive = { input: { enabled: true }, parentContainer: null };
    const { stick: uiStick, down: downUi } = makeStickHarness(
      {},
      {
        hitTestPointer: () => [interactive],
      },
    );
    downUi(200, 200);
    expect(uiStick.getDebugState().pointerId).toBe(null);

    const child = {
      input: { enabled: false },
      parentContainer: { input: { enabled: false } },
    };
    const blockedParent = child.parentContainer;
    const { stick: blocked, down: downBlocked } = makeStickHarness(
      { blockers: [blockedParent as never] },
      { hitTestPointer: () => [child] },
    );
    downBlocked(200, 200);
    expect(blocked.getDebugState().pointerId).toBe(null);

    const inert = { input: undefined, parentContainer: null };
    const {
      stick: open,
      down: downOpen,
      stick: _s,
    } = makeStickHarness({}, { hitTestPointer: () => [inert] });
    downOpen(200, 200);
    expect(open.getDebugState().pointerId).toBe(1);
    open.destroy({ input: { off: () => undefined } } as never);
  });
});

describe("VirtualStick leftover branches", () => {
  it("destroys the sprites when the scene has no input plugin", () => {
    const { stick } = makeStickHarness();
    expect(() => stick.destroy({} as never)).not.toThrow();
  });

  it("ignores a move after the gesture is no longer active or pending", () => {
    const { stick, down, move } = makeStickHarness();
    down(200, 200);
    const box = stick as unknown as { pending: boolean; active: boolean };
    box.pending = false;
    box.active = false;
    move(400, 200);
    expect(stick.getDirection().x).toBe(0);
    expect(stick.getDebugState().active).toBe(false);
  });

  it("clears a press that is neither a drag nor still pending", () => {
    const { stick, down, up } = makeStickHarness();
    down(200, 200);
    const box = stick as unknown as {
      pending: boolean;
      gestureHadDrag: boolean;
    };
    box.pending = false;
    box.gestureHadDrag = false;
    up(200, 200);
    expect(stick.getDebugState().pointerId).toBe(null);
    expect(stick.tryConsumeTap({ id: 1, x: 200, y: 200 } as never)).toEqual({
      kind: "none",
    });
  });

  it("ignores hits on the stick's own base or knob", () => {
    const { stick, down } = makeStickHarness(
      {},
      {
        hitTestPointer: () => {
          const box = stick as unknown as { base: unknown; knob: unknown };
          return [box.base, box.knob];
        },
      },
    );
    down(200, 200);
    expect(stick.getDebugState().pointerId).toBe(1);
  });
});
