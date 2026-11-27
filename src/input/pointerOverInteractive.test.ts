import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { isPointerOverInteractive } from "./pointerOverInteractive";

type FakeNode = {
  input?: { enabled: boolean };
  parentContainer?: FakeNode | null;
};

function sceneWithHits(hits: FakeNode[]): {
  scene: Phaser.Scene;
  hitTestPointer: ReturnType<typeof vi.fn>;
} {
  const hitTestPointer = vi.fn(() => hits);
  const scene = {
    input: { hitTestPointer },
  } as unknown as Phaser.Scene;
  return { scene, hitTestPointer };
}

const pointer = { id: 1 } as unknown as Phaser.Input.Pointer;

describe("isPointerOverInteractive", () => {
  it("hit-tests the pointer and reports nothing when the scene is empty", () => {
    const { scene, hitTestPointer } = sceneWithHits([]);
    expect(isPointerOverInteractive(scene, pointer)).toBe(false);
    expect(hitTestPointer).toHaveBeenCalledWith(pointer);
  });

  it("returns true for an enabled interactive hit", () => {
    const { scene } = sceneWithHits([{ input: { enabled: true } }]);
    expect(isPointerOverInteractive(scene, pointer)).toBe(true);
  });

  it("walks up to an interactive ancestor when the hit itself is disabled", () => {
    const container: FakeNode = { input: { enabled: true } };
    const { scene } = sceneWithHits([
      { input: { enabled: false }, parentContainer: container },
    ]);
    expect(isPointerOverInteractive(scene, pointer)).toBe(true);
  });

  it("returns false when no node in the parent chain is interactive", () => {
    const container: FakeNode = { parentContainer: null };
    const { scene } = sceneWithHits([
      { input: { enabled: false }, parentContainer: container },
    ]);
    expect(isPointerOverInteractive(scene, pointer)).toBe(false);
  });

  it("keeps scanning later hits after a non-interactive one", () => {
    const { scene } = sceneWithHits([
      { input: { enabled: false } },
      { parentContainer: null },
      { input: { enabled: true } },
    ]);
    expect(isPointerOverInteractive(scene, pointer)).toBe(true);
  });
});
