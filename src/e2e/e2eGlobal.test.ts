import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultE2EState,
  getE2EState,
  publishE2E,
  type DefenseGameE2EApi,
} from "./e2eGlobal";

describe("e2eGlobal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a fresh default state when window is missing", () => {
    vi.stubGlobal("window", undefined);
    const a = getE2EState();
    const b = getE2EState();
    expect(a).toEqual(defaultE2EState());
    expect(a).not.toBe(b);
  });

  it("initializes and reuses window state", () => {
    const win = {} as Window & { __DEFENSEGAME_E2E__?: unknown };
    vi.stubGlobal("window", win);
    const first = getE2EState();
    expect(first.scene).toBe("boot");
    expect(first.api).toBeNull();
    expect(getE2EState()).toBe(first);
  });

  it("publishes patches, merges flags, and replaces or keeps the api", () => {
    const win = {} as Window & { __DEFENSEGAME_E2E__?: unknown };
    vi.stubGlobal("window", win);
    const apiA = {
      startNight: () => undefined,
    } as unknown as DefenseGameE2EApi;
    publishE2E({
      ready: true,
      scene: "Town",
      flags: { a: 1 },
      api: apiA,
    });
    expect(getE2EState().ready).toBe(true);
    expect(getE2EState().scene).toBe("Town");
    expect(getE2EState().flags).toEqual({ a: 1 });
    expect(getE2EState().api).toMatchObject({ startNight: apiA.startNight });

    publishE2E({ flags: { b: 2 } });
    expect(getE2EState().flags).toEqual({ a: 1, b: 2 });
    expect(getE2EState().api).toMatchObject({ startNight: apiA.startNight });

    publishE2E({ api: null, flags: { c: 3 } });
    expect(getE2EState().api).toBeNull();
    expect(getE2EState().flags).toEqual({ a: 1, b: 2, c: 3 });

    publishE2E({
      api: { clearStick: () => undefined } as unknown as DefenseGameE2EApi,
    });
    expect(getE2EState().api).toMatchObject({
      clearStick: expect.any(Function),
    });
  });
});
