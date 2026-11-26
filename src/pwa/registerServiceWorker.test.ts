import { describe, expect, it, vi } from "vitest";
import {
  registerServiceWorkerWith,
  serviceWorkerScriptUrl,
  shouldRegisterServiceWorker,
} from "./registerServiceWorker";

describe("shouldRegisterServiceWorker", () => {
  it("registers only in production, outside e2e, and not in the native app", () => {
    expect(shouldRegisterServiceWorker({ prod: true, e2e: false })).toBe(true);
    expect(shouldRegisterServiceWorker({ prod: true, e2e: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ prod: false, e2e: false })).toBe(
      false,
    );
    expect(shouldRegisterServiceWorker({ prod: false, e2e: true })).toBe(false);
    expect(
      shouldRegisterServiceWorker({ prod: true, e2e: false, native: true }),
    ).toBe(false);
    expect(
      shouldRegisterServiceWorker({ prod: true, e2e: false, native: false }),
    ).toBe(true);
  });
});

describe("serviceWorkerScriptUrl", () => {
  it("puts sw.js under the Vite base path", () => {
    expect(serviceWorkerScriptUrl("/")).toBe("/sw.js");
    expect(serviceWorkerScriptUrl("/DefenseGame/")).toBe("/DefenseGame/sw.js");
  });

  it("adds a trailing slash when the base omits one", () => {
    expect(serviceWorkerScriptUrl("/DefenseGame")).toBe("/DefenseGame/sw.js");
  });
});

describe("registerServiceWorkerWith", () => {
  it("skips when disabled or when service workers are unavailable", async () => {
    const register = vi.fn();
    expect(
      await registerServiceWorkerWith({
        enabled: false,
        scriptUrl: "/sw.js",
        serviceWorker: { register },
      }),
    ).toBe("skipped");
    expect(register).not.toHaveBeenCalled();

    expect(
      await registerServiceWorkerWith({
        enabled: true,
        scriptUrl: "/sw.js",
      }),
    ).toBe("skipped");
  });

  it("registers and checks for an updated worker", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update });

    await expect(
      registerServiceWorkerWith({
        enabled: true,
        scriptUrl: "/DefenseGame/sw.js",
        serviceWorker: { register },
      }),
    ).resolves.toBe("registered");

    expect(register).toHaveBeenCalledWith("/DefenseGame/sw.js");
    expect(update).toHaveBeenCalledOnce();
  });

  it("skips when registration fails so the game can still boot", async () => {
    const register = vi.fn().mockRejectedValue(new Error("failed"));
    await expect(
      registerServiceWorkerWith({
        enabled: true,
        scriptUrl: "/sw.js",
        serviceWorker: { register },
      }),
    ).resolves.toBe("skipped");
  });
});
