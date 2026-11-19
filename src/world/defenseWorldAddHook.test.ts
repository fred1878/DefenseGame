import { describe, expect, it } from "vitest";
import { runDefenseUiFactory } from "./defenseWorldAddHook";

describe("runDefenseUiFactory", () => {
  it("clears suppress flag after HUD factory completes", () => {
    const registry = {
      data: new Map<string, unknown>(),
      get(key: string) {
        return this.data.get(key);
      },
      set(key: string, value: unknown) {
        this.data.set(key, value);
      },
      remove(key: string) {
        this.data.delete(key);
      },
    };
    const scene = { registry } as unknown as Phaser.Scene;
    let sawSuppress = false;
    runDefenseUiFactory(scene, () => {
      sawSuppress = registry.get("defenseSuppressWorldAdopt") === true;
      return 1;
    });
    expect(sawSuppress).toBe(true);
    expect(registry.get("defenseSuppressWorldAdopt")).toBeUndefined();
  });
});