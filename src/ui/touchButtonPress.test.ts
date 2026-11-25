import Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scaleUiX } from "../core/displayScale";
import { VIRTUAL_STICK_DRAG_THRESHOLD_PX } from "../input/inputTuning";
import { FakeEmitter, fakeEventData, fakePointer } from "../test/fakeInput";
import {
  bindPress,
  bindTapOrLongPress,
  darkenColor,
  darkenTint,
} from "./touchButtonPress";

type FakeScene = {
  input: FakeEmitter & { hitTestPointer: ReturnType<typeof vi.fn> };
  events: FakeEmitter;
  tweens: {
    add: ReturnType<typeof vi.fn>;
    killTweensOf: ReturnType<typeof vi.fn>;
  };
};

function fakeScene(): FakeScene {
  const input = Object.assign(new FakeEmitter(), {
    hitTestPointer: vi.fn((): unknown[] => []),
  });
  return {
    input,
    events: new FakeEmitter(),
    tweens: { add: vi.fn(), killTweensOf: vi.fn() },
  };
}

/** Container-like button (instanceof the stub Container) with its own emitter. */
function fakeButton() {
  const emitter = new FakeEmitter();
  const container = Object.assign(
    Object.create(Phaser.GameObjects.Container.prototype),
    {
      list: [] as unknown[],
      input: { alwaysEnabled: false },
      on: emitter.on.bind(emitter),
      off: emitter.off.bind(emitter),
      emit: emitter.emit.bind(emitter),
    },
  );
  return container;
}

function press(btn: ReturnType<typeof fakeButton>, x = 10, y = 10, id = 1) {
  btn.emit("pointerdown", fakePointer(x, y, id), 0, 0, fakeEventData());
}

const asScene = (s: FakeScene) => s as unknown as Phaser.Scene;
const asGo = (b: ReturnType<typeof fakeButton>) =>
  b as unknown as Phaser.GameObjects.GameObject;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("darkenTint / darkenColor", () => {
  it("scales each RGB channel and floors", () => {
    expect(darkenTint(0xffffff, 0.5)).toBe(0x7f7f7f);
    expect(darkenColor(0x804020, 0.5)).toBe(0x402010);
    expect(darkenTint(0x000000)).toBe(0);
  });
});

describe("bindPress", () => {
  it("fires onPress once when released on the button", () => {
    const scene = fakeScene();
    const btn = fakeButton();
    const onPress = vi.fn();
    const bg = { setFillStyle: vi.fn() };
    bindPress(asScene(scene), asGo(btn), onPress, {
      bg: bg as never,
      colors: { rest: 0x111111, pressed: 0x222222 },
    });
    expect(btn.input.alwaysEnabled).toBe(true);

    press(btn);
    expect(bg.setFillStyle).toHaveBeenLastCalledWith(0x222222, 1);
    expect(scene.tweens.add).toHaveBeenCalledWith(
      expect.objectContaining({ scaleX: 0.9, scaleY: 0.9 }),
    );

    scene.input.hitTestPointer.mockReturnValue([btn]);
    scene.input.emit("pointerup", fakePointer(10, 10));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(bg.setFillStyle).toHaveBeenLastCalledWith(0x111111, 1);

    // A second release without a new press is ignored.
    scene.input.emit("pointerup", fakePointer(10, 10));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("counts a hit on a child object of the button", () => {
    const scene = fakeScene();
    const btn = fakeButton();
    const child = { parentContainer: btn };
    btn.list.push(child);
    const onPress = vi.fn();
    bindPress(asScene(scene), asGo(btn), onPress);
    press(btn);
    scene.input.hitTestPointer.mockReturnValue([child]);
    scene.input.emit("pointerupoutside", fakePointer(10, 10));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("ignores releases off the button and from other pointers", () => {
    const scene = fakeScene();
    const btn = fakeButton();
    const onPress = vi.fn();
    bindPress(asScene(scene), asGo(btn), onPress);

    press(btn, 10, 10, 1);
    scene.input.emit("pointerup", fakePointer(10, 10, 2));
    expect(onPress).not.toHaveBeenCalled();

    // Same pointer, but nothing under it and no hit area to fall back on.
    scene.input.emit("pointerup", fakePointer(400, 400, 1));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("removes scene listeners on shutdown", () => {
    const scene = fakeScene();
    const btn = fakeButton();
    bindPress(asScene(scene), asGo(btn), vi.fn());
    expect(scene.input.listenerCount("pointerup")).toBe(1);
    scene.events.emit(Phaser.Scenes.Events.SHUTDOWN);
    expect(scene.input.listenerCount("pointerup")).toBe(0);
    expect(scene.input.listenerCount("pointerupoutside")).toBe(0);
    expect(scene.input.listenerCount("pointercancel")).toBe(0);
  });

  it("tints image backgrounds with setTint", () => {
    const scene = fakeScene();
    const btn = fakeButton();
    const img = Object.assign(
      Object.create(Phaser.GameObjects.Image.prototype),
      {
        setTint: vi.fn(),
      },
    );
    bindPress(asScene(scene), asGo(btn), vi.fn(), {
      bg: img as never,
      colors: { rest: 1, pressed: 2 },
    });
    press(btn);
    expect(img.setTint).toHaveBeenCalledWith(2);
  });
});

describe("bindTapOrLongPress", () => {
  function setup(longPressMs = 400) {
    const scene = fakeScene();
    const btn = fakeButton();
    const callbacks = {
      onTap: vi.fn(),
      onLongPress: vi.fn(),
      onPressStart: vi.fn(),
      longPressMs,
    };
    bindTapOrLongPress(asScene(scene), asGo(btn), callbacks);
    scene.input.hitTestPointer.mockReturnValue([btn]);
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const advance = (ms: number) => {
      now += ms;
    };
    return { scene, btn, callbacks, advance };
  }

  it("short press on the button is a tap", () => {
    const { scene, btn, callbacks, advance } = setup();
    press(btn);
    expect(callbacks.onPressStart).toHaveBeenCalledTimes(1);
    advance(100);
    scene.input.emit("pointerup", fakePointer(10, 10));
    expect(callbacks.onTap).toHaveBeenCalledTimes(1);
    expect(callbacks.onLongPress).not.toHaveBeenCalled();
  });

  it("holding past longPressMs is a long press", () => {
    const { scene, btn, callbacks, advance } = setup(400);
    press(btn);
    advance(450);
    scene.input.emit("pointerup", fakePointer(10, 10));
    expect(callbacks.onLongPress).toHaveBeenCalledTimes(1);
    expect(callbacks.onTap).not.toHaveBeenCalled();
  });

  it("dragging past the threshold cancels both", () => {
    const { scene, btn, callbacks, advance } = setup();
    press(btn, 10, 10);
    const far = 10 + scaleUiX(VIRTUAL_STICK_DRAG_THRESHOLD_PX) + 2;
    scene.input.emit("pointermove", fakePointer(far, 10));
    advance(50);
    scene.input.emit("pointerup", fakePointer(far, 10));
    expect(callbacks.onTap).not.toHaveBeenCalled();
    expect(callbacks.onLongPress).not.toHaveBeenCalled();
  });

  it("small moves and moves while not held do not cancel the tap", () => {
    const { scene, btn, callbacks, advance } = setup();
    press(btn, 10, 10);
    scene.input.emit("pointermove", fakePointer(12, 11));
    scene.input.emit("pointermove", fakePointer(400, 10, 1, false));
    advance(50);
    scene.input.emit("pointerup", fakePointer(12, 11));
    expect(callbacks.onTap).toHaveBeenCalledTimes(1);
  });

  it("release off the button does nothing", () => {
    const { scene, btn, callbacks, advance } = setup();
    press(btn);
    advance(50);
    scene.input.hitTestPointer.mockReturnValue([]);
    scene.input.emit("pointercancel", fakePointer(300, 300));
    expect(callbacks.onTap).not.toHaveBeenCalled();
    expect(callbacks.onLongPress).not.toHaveBeenCalled();
  });

  it("removes scene listeners on destroy", () => {
    const { scene } = setup();
    scene.events.emit(Phaser.Scenes.Events.DESTROY);
    expect(scene.input.listenerCount("pointermove")).toBe(0);
    expect(scene.input.listenerCount("pointerup")).toBe(0);
  });
});
