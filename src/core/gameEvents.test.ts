import { describe, expect, it, vi } from "vitest";
import {
  emitGameEvent,
  hasGameEventListeners,
  onGameEvent,
} from "./gameEvents";

describe("gameEvents", () => {
  it("delivers payloads to listeners until they unsubscribe", () => {
    expect(hasGameEventListeners("enemyMeleeFx")).toBe(false);
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
    expect(hasGameEventListeners("enemyMeleeFx")).toBe(false);
  });

  it("ignores events nobody listens to", () => {
    expect(() => emitGameEvent("playerMeleeFx", {})).not.toThrow();
  });
});
