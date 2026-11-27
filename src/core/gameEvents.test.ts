import { describe, expect, it, vi } from "vitest";
import {
  emitGameEvent,
  hasGameEventListeners,
  onGameEvent,
} from "./gameEvents";

describe("gameEvents", () => {
  it("delivers payloads to listeners until they unsubscribe", () => {
    const fn = vi.fn();
    const off = onGameEvent("enemyMeleeFx", fn);
    expect(hasGameEventListeners("enemyMeleeFx")).toBe(true);
    const payload = {
      enemyDefId: "grunt",
      facingRad: 1,
      rotation: 2,
      flipX: true,
    };
    emitGameEvent("enemyMeleeFx", payload);
    expect(fn).toHaveBeenCalledWith(payload);
    off();
    emitGameEvent("enemyMeleeFx", payload);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reports no listeners once the last one unsubscribes", () => {
    const off = onGameEvent("playerMeleeFx", () => {});
    expect(hasGameEventListeners("playerMeleeFx")).toBe(true);
    off();
    expect(hasGameEventListeners("playerMeleeFx")).toBe(false);
    expect(() => emitGameEvent("playerMeleeFx", {})).not.toThrow();
  });
});
