import { describe, expect, it, vi } from "vitest";
import {
  blocksBaseLayerInput,
  clearInputModalities,
  INPUT_MODALITY,
  isInputModalityActive,
  peekInputModality,
  popInputModality,
  pushInputModality,
} from "./inputModality";

function mockScene() {
  const registry = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();
  const scene = {
    scene: { key: "Town" },
    registry: {
      get: (k: string) => registry.get(k),
      set: (k: string, v: unknown) => registry.set(k, v),
    },
    events: {
      emit: (event: string) => {
        for (const fn of listeners.get(event) ?? []) fn();
      },
      on: (event: string, fn: () => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
      },
    },
  } as unknown as Phaser.Scene;
  return scene;
}

describe("inputModality stack", () => {
  it("push and pop by id", () => {
    const scene = mockScene();
    pushInputModality(scene, INPUT_MODALITY.townSpellSort);
    expect(isInputModalityActive(scene, INPUT_MODALITY.townSpellSort.id)).toBe(
      true,
    );
    expect(peekInputModality(scene)?.id).toBe(INPUT_MODALITY.townSpellSort.id);
    popInputModality(scene, INPUT_MODALITY.townSpellSort.id);
    expect(peekInputModality(scene)).toBeNull();
  });

  it("ignores duplicate pushes", () => {
    const scene = mockScene();
    pushInputModality(scene, INPUT_MODALITY.townSpellSort);
    pushInputModality(scene, INPUT_MODALITY.townSpellSort);
    expect(peekInputModality(scene)?.id).toBe(INPUT_MODALITY.townSpellSort.id);
  });

  it("blocksBaseLayerInput only for modal layer", () => {
    const scene = mockScene();
    expect(blocksBaseLayerInput(scene)).toBe(false);
    pushInputModality(scene, INPUT_MODALITY.defenseGroundAim);
    expect(blocksBaseLayerInput(scene)).toBe(false);
    pushInputModality(scene, INPUT_MODALITY.debugMenu);
    expect(blocksBaseLayerInput(scene)).toBe(true);
    expect(peekInputModality(scene)?.id).toBe(INPUT_MODALITY.debugMenu.id);
  });

  it("clearInputModalities empties stack", () => {
    const scene = mockScene();
    pushInputModality(scene, INPUT_MODALITY.townEndless);
    clearInputModalities(scene);
    expect(peekInputModality(scene)).toBeNull();
  });

  it("emits on change", () => {
    const scene = mockScene();
    const fn = vi.fn();
    scene.events.on("input-modality-changed", fn);
    pushInputModality(scene, INPUT_MODALITY.townWavePlanner);
    expect(fn).toHaveBeenCalledTimes(1);
    popInputModality(scene, INPUT_MODALITY.townWavePlanner.id);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("inputModality leftover branches", () => {
  it("ignores popping an unknown id and clearing an empty stack", () => {
    const scene = mockScene();
    popInputModality(scene, "missing");
    expect(peekInputModality(scene)).toBeNull();
    clearInputModalities(scene);
    expect(peekInputModality(scene)).toBeNull();
  });
});
