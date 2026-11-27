import { describe, expect, it, vi } from "vitest";
import { UI_FRAMES, uiPartKey, UI_PART_ASSETS } from "../../content/uiParts";
import {
  addUiFrame,
  frameTouchButton,
  hasUiPart,
  layoutUiFrame,
  setUiFrame,
} from "./uiFrame";

function fakeNs() {
  const ns = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    scale: 1,
    key: "",
    setScale: vi.fn((s: number) => {
      ns.scale = s;
      return ns;
    }),
    setSize: vi.fn((w: number, h: number) => {
      ns.w = w;
      ns.h = h;
      return ns;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      ns.x = x;
      ns.y = y;
      return ns;
    }),
    setOrigin: vi.fn(() => ns),
    setTexture: vi.fn((k: string) => {
      ns.key = k;
      return ns;
    }),
    setSlices: vi.fn(() => ns),
  };
  return ns;
}

function fakeScene(hasTex = true) {
  const ns = fakeNs();
  return {
    ns,
    scene: {
      textures: { exists: () => hasTex },
      add: { nineslice: vi.fn(() => ns) },
    },
  };
}

describe("uiParts", () => {
  it("keys every shipped part", () => {
    expect(uiPartKey("da-btn")).toBe("uipart_da-btn");
    expect(UI_PART_ASSETS.find((a) => a.file === "gp-oval.png")?.key).toBe(
      "uipart_gp-oval",
    );
  });
});

describe("uiFrame", () => {
  it("lays a frame at its scale with the crest above the box", () => {
    const ns = fakeNs();
    layoutUiFrame(ns as never, "btnGreen", 10, 100, 200, 50);
    expect(ns.scale).toBe(2);
    expect(ns.w).toBe(100);
    expect(ns.h).toBe(30);
    expect(ns.y).toBe(100 - UI_FRAMES.btnGreen.extendTop);
  });

  it("never shrinks below the slice insets", () => {
    const ns = fakeNs();
    layoutUiFrame(ns as never, "ornate", 0, 0, 10, 10);
    expect(ns.w * ns.scale).toBe(26);
  });

  it("adds, swaps and frames buttons when the texture exists", () => {
    const { scene, ns } = fakeScene();
    expect(hasUiPart(scene as never, "da-btn")).toBe(true);
    expect(addUiFrame(scene as never, "dark", 0, 0, 100, 60)).toBe(ns);
    setUiFrame(ns as never, "btnRed", 0, 0, 100, 60);
    expect(ns.key).toBe(uiPartKey("da-btn-red"));
    const container = { addAt: vi.fn() };
    expect(
      frameTouchButton(scene as never, container as never, "btn", 80, 40),
    ).toBe(ns);
    expect(container.addAt).toHaveBeenCalledWith(ns, 1);
  });

  it("returns null on the Canvas renderer, where NineSlice cannot draw", () => {
    const { scene } = fakeScene();
    const canvasScene = { ...scene, game: { renderer: { type: 1 } } };
    expect(addUiFrame(canvasScene as never, "dark", 0, 0, 100, 60)).toBeNull();
    const webgl = { ...scene, game: { renderer: { type: 2 } } };
    expect(addUiFrame(webgl as never, "dark", 0, 0, 100, 60)).toBe(
      scene.add.nineslice.mock.results[0]?.value,
    );
  });

  it("returns null without the texture", () => {
    const { scene } = fakeScene(false);
    expect(addUiFrame(scene as never, "dark", 0, 0, 100, 60)).toBeNull();
    expect(
      frameTouchButton(
        scene as never,
        { addAt: vi.fn() } as never,
        "btn",
        8,
        8,
      ),
    ).toBeNull();
  });
});
