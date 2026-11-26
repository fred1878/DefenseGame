import { describe, expect, it, vi } from "vitest";
import Phaser from "phaser";
import { collectInteractiveScreenRects } from "./collectInteractiveScreenRects";

vi.mock("../ui/touchButton", () => ({
  interactiveObjectScreenRect: (obj: Phaser.GameObjects.GameObject) => {
    const tag = (obj as { __rectTag?: string }).__rectTag;
    if (!tag) return null;
    if (tag === "a") return { x: 0, y: 0, width: 40, height: 40 };
    if (tag === "b") return { x: 50, y: 0, width: 30, height: 30 };
    if (tag === "zero") return { x: 0, y: 0, width: 0, height: 10 };
    return null;
  },
}));

function fakeInteractive(
  tag: string,
  opts?: { enabled?: boolean; active?: boolean },
): Phaser.GameObjects.GameObject {
  const enabled = opts?.enabled ?? true;
  const active = opts?.active ?? true;
  return {
    __rectTag: tag,
    active,
    input: enabled
      ? { enabled: true, hitArea: new Phaser.Geom.Rectangle(-10, -10, 20, 20) }
      : { enabled: false },
  } as unknown as Phaser.GameObjects.GameObject;
}

function fakeContainer(
  children: Phaser.GameObjects.GameObject[],
): Phaser.GameObjects.Container {
  return {
    active: true,
    input: undefined,
    list: children,
  } as unknown as Phaser.GameObjects.Container;
}

function fakeScene(roots: Phaser.GameObjects.GameObject[]): Phaser.Scene {
  return {
    children: { list: roots },
    cameras: { main: {} },
  } as unknown as Phaser.Scene;
}

describe("collectInteractiveScreenRects", () => {
  it("collects enabled interactives with hit areas from the display list", () => {
    const scene = fakeScene([
      fakeInteractive("a"),
      fakeInteractive("b"),
      fakeInteractive("none", { enabled: false }),
    ]);
    const rects = collectInteractiveScreenRects(scene);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it("walks container children recursively", () => {
    const scene = fakeScene([
      fakeContainer([fakeInteractive("b")]),
      fakeInteractive("a"),
    ]);
    expect(collectInteractiveScreenRects(scene)).toHaveLength(2);
  });

  it("dedupes the same object visited twice", () => {
    const leaf = fakeInteractive("a");
    const scene = fakeScene([fakeContainer([leaf]), leaf]);
    expect(collectInteractiveScreenRects(scene)).toHaveLength(1);
  });

  it("skips objects in the skip set", () => {
    const skipped = fakeInteractive("a");
    const scene = fakeScene([skipped, fakeInteractive("b")]);
    expect(
      collectInteractiveScreenRects(scene, { skip: [skipped] }),
    ).toHaveLength(1);
  });

  it("skips interactive objects with no or zero-size screen rect", () => {
    const scene = fakeScene([
      fakeInteractive("zero"),
      fakeInteractive(""),
      fakeInteractive("a"),
    ]);
    expect(collectInteractiveScreenRects(scene)).toHaveLength(1);
  });
});
