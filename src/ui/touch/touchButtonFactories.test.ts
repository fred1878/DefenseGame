import { describe, expect, it, vi } from "vitest";
import { fakeEventData, fakePointer } from "../../test/fakeInput";
import {
  asScene,
  fakeScene,
  type FakeGameObject,
  type FakeScene,
} from "../../test/fakeScene";
import {
  createTouchButton,
  createTouchCircleButton,
  createTouchToggleButton,
} from "./touchButtonFactories";
import { MEDIEVAL_LABEL } from "./touchButtonPress";
import { isUiRoundedRect, type UiRoundedRect } from "../layout/uiRoundedRect";

const asGo = (c: unknown) => c as unknown as FakeGameObject;

/** Press on the button, then release with the pointer over it (hit test reports the container). */
function tap(scene: FakeScene, container: FakeGameObject, id = 1) {
  container.emit("pointerdown", fakePointer(0, 0, id), 0, 0, fakeEventData());
  scene.input.hitTestPointer.mockReturnValueOnce([container]);
  scene.input.emit("pointerup", fakePointer(0, 0, id));
}

describe("createTouchButton", () => {
  it("builds a rounded vector button with padded hit area and fires on tap-release", () => {
    const scene = fakeScene();
    const onPress = vi.fn();
    const { container, setLabel } = createTouchButton(
      asScene(scene),
      10.4,
      19.6,
      "Go",
      onPress,
      {
        width: 100,
        height: 40,
        tapPadding: 10,
        depth: 7,
      },
    );
    const c = asGo(container);
    expect(c.args.slice(0, 2)).toEqual([10, 20]);
    expect(c.last("setDepth")).toEqual([7]);
    expect(c.last("setSize")).toEqual([120, 60]);
    const [bg, text] = c.list as FakeGameObject[];
    expect(isUiRoundedRect(bg as never)).toBe(true);
    expect((bg as unknown as UiRoundedRect).__uiRounded).toMatchObject({
      w: 100,
      h: 40,
      fill: 0x3b82f6,
    });
    expect(text!.args[2]).toBe("Go");

    tap(scene, c);
    expect(onPress).toHaveBeenCalledTimes(1);
    // pressed then rest tint repainted
    expect((bg as unknown as UiRoundedRect).__uiRounded.fill).toBe(0x3b82f6);

    setLabel("Stop");
    expect(text!.last("setText")).toEqual(["Stop"]);
  });

  it("does not fire when released off the button or by another pointer", () => {
    const scene = fakeScene();
    const onPress = vi.fn();
    const { container } = createTouchButton(
      asScene(scene),
      0,
      0,
      "X",
      onPress,
      { width: 10, height: 10 },
    );
    const c = asGo(container);
    c.emit("pointerdown", fakePointer(0, 0, 1), 0, 0, fakeEventData());
    scene.input.emit("pointerup", fakePointer(0, 0, 2)); // other finger
    scene.input.emit("pointerup", fakePointer(999, 999, 1)); // released elsewhere
    expect(onPress).not.toHaveBeenCalled();
  });

  it("uses the frame texture with medieval label colours when available", () => {
    const scene = fakeScene({ textures: ["frame"] });
    const { container } = createTouchButton(
      asScene(scene),
      0,
      0,
      "Town",
      () => {},
      {
        width: 80,
        height: 30,
        frameTextureKey: "frame",
        fontSize: "20px",
      },
    );
    const [bg, text] = asGo(container).list as FakeGameObject[];
    expect(bg!.kind).toBe("image");
    expect(bg!.last("setDisplaySize")).toEqual([80, 30]);
    expect((text!.args[3] as { color: string }).color).toBe(
      MEDIEVAL_LABEL.color,
    );
  });

  it("skipPressBinding leaves the button inert", () => {
    const scene = fakeScene();
    const onPress = vi.fn();
    const { container } = createTouchButton(
      asScene(scene),
      0,
      0,
      "X",
      onPress,
      {
        width: 10,
        height: 10,
        skipPressBinding: true,
      },
    );
    tap(scene, asGo(container));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("createTouchToggleButton", () => {
  it("toggles vector colours and label colour with setOn", () => {
    const scene = fakeScene();
    const t = createTouchToggleButton(
      asScene(scene),
      0,
      0,
      "Auto",
      60,
      30,
      () => {},
    );
    const [bg, text] = asGo(t.container).list as FakeGameObject[];
    const meta = (bg as unknown as UiRoundedRect).__uiRounded;
    expect(t.getOn()).toBe(false);
    t.setOn(true);
    expect(t.getOn()).toBe(true);
    expect(meta).toMatchObject({ fill: 0x15803d, stroke: 0x4ade80 });
    expect(text!.last("setColor")).toEqual(["#bbf7d0"]);
    t.setOn(false);
    expect(meta).toMatchObject({ fill: 0x3f3f46, stroke: 0x71717a });
    expect(text!.last("setColor")).toEqual(["#e4e4e7"]);
  });

  it("textured toggles tint the frame and use custom on/off colours", () => {
    const scene = fakeScene({ textures: ["f"] });
    const onPress = vi.fn();
    const t = createTouchToggleButton(
      asScene(scene),
      0,
      0,
      "A",
      60,
      30,
      onPress,
      5,
      {
        frameTextureKey: "f",
        onBgTint: 0x00ff00,
        onTextColor: "#0f0",
      },
    );
    const [bg, text] = asGo(t.container).list as FakeGameObject[];
    t.setOn(true);
    expect(bg!.last("setTint")).toEqual([0x00ff00]);
    expect(text!.last("setColor")).toEqual(["#0f0"]);
    t.setOn(false);
    expect(bg!.last("setTint")).toEqual([0xffffff]);
    expect(text!.last("setColor")).toEqual([MEDIEVAL_LABEL.color]);
    tap(scene, asGo(t.container));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shrinks the font for two-line labels", () => {
    const scene = fakeScene();
    const t = createTouchToggleButton(
      asScene(scene),
      0,
      0,
      "Auto\nCast",
      60,
      30,
      () => {},
    );
    const text = (asGo(t.container).list as FakeGameObject[])[1]!;
    expect(text.callsTo("setFontSize")).toHaveLength(1);
    t.setLabel("One");
    expect(text.callsTo("setFontSize")).toHaveLength(1);
    t.setLabel("Two\nLines");
    expect(text.callsTo("setFontSize")).toHaveLength(2);
    expect(text.last("setText")).toEqual(["Two\nLines"]);
  });
});

describe("createTouchCircleButton", () => {
  it("draws an orange circle with a padded circular hit area", () => {
    const scene = fakeScene();
    const onPress = vi.fn();
    const c = asGo(
      createTouchCircleButton(asScene(scene), 5, 5, "ATK", 30, onPress),
    );
    const [bg] = c.list as FakeGameObject[];
    expect(bg!.kind).toBe("circle");
    expect(bg!.args).toEqual([0, 0, 30, 0xea580c, 1]);
    const [w] = c.last("setSize") as [number];
    expect(w).toBeGreaterThan(60);
    tap(scene, c);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses the frame image sized to the diameter when loaded", () => {
    const scene = fakeScene({ textures: ["ring"] });
    const c = asGo(
      createTouchCircleButton(
        asScene(scene),
        0,
        0,
        "",
        20,
        () => {},
        150,
        "ring",
      ),
    );
    const [bg] = c.list as FakeGameObject[];
    expect(bg!.kind).toBe("image");
    expect(bg!.last("setDisplaySize")).toEqual([40, 40]);
  });
});
