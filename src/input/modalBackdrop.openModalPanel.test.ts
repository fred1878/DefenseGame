import { describe, expect, it, vi } from "vitest";

vi.mock("./inputModality", () => ({
  pushInputModality: vi.fn(),
  popInputModality: vi.fn(),
}));

import { popInputModality, pushInputModality } from "./inputModality";
import { openModalPanel } from "./modalBackdrop";

function fakeScene() {
  const root = {
    active: true,
    depth: 0,
    children: [] as unknown[],
    setDepth(d: number) {
      this.depth = d;
      return this;
    },
    setScrollFactor() {
      return this;
    },
    add(o: unknown) {
      this.children.push(o);
      return this;
    },
    destroy: vi.fn(function (this: { active: boolean }) {
      this.active = false;
    }),
  };
  const rects: unknown[][] = [];
  const scene = {
    add: {
      container: () => root,
      rectangle: (...args: unknown[]) => {
        rects.push(args);
        return { args };
      },
    },
  };
  return { scene, root, rects };
}

describe("openModalPanel", () => {
  const token = { id: "test-modal" } as never;

  it("builds a dimmed root at the default depth and pushes the modal token", () => {
    const { scene, root, rects } = fakeScene();
    const modal = openModalPanel(scene as never, { token });
    expect(pushInputModality).toHaveBeenCalledWith(scene, token);
    expect(root.depth).toBe(500);
    expect(rects[0]?.slice(4)).toEqual([0x000000, 0.72]);
    expect(root.children).toEqual([modal.dim]);
  });

  it("honours depth and dim overrides", () => {
    const { scene, root, rects } = fakeScene();
    openModalPanel(scene as never, {
      token,
      depth: 900,
      dimColor: 0x123456,
      dimAlpha: 1,
    });
    expect(root.depth).toBe(900);
    expect(rects[0]?.slice(4)).toEqual([0x123456, 1]);
  });

  it("close releases the lease and destroys the root once", () => {
    const { scene, root } = fakeScene();
    const modal = openModalPanel(scene as never, { token });
    modal.close();
    modal.close();
    expect(popInputModality).toHaveBeenCalledTimes(1);
    expect(root.destroy).toHaveBeenCalledTimes(1);
  });
});
