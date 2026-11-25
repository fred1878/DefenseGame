import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureFreshBuild } from "./ensureFreshBuild";

const env = import.meta.env as unknown as Record<string, unknown>;
const originalEnv = { ...env };

function setEnv(partial: Record<string, unknown>): void {
  for (const key of Object.keys(env)) {
    delete env[key];
  }
  Object.assign(env, originalEnv, partial);
}

describe("ensureFreshBuild", () => {
  afterEach(() => {
    setEnv({});
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips the check outside production", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setEnv({ PROD: false });
    await ensureFreshBuild();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the check in e2e mode even in production", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setEnv({ PROD: true, VITE_E2E: "true" });
    await ensureFreshBuild();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reloads once when the live build id differs", async () => {
    const replace = vi.fn();
    setEnv({
      PROD: true,
      VITE_E2E: "false",
      VITE_BUILD_ID: "old",
      BASE_URL: "/",
    });
    vi.stubGlobal("window", {
      location: { href: "https://example.com/game/", replace },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ buildId: "new" }),
      })),
    );
    await ensureFreshBuild();
    expect(replace).toHaveBeenCalledOnce();
    const url = String(replace.mock.calls[0]![0]);
    expect(url).toContain("b=new");
    expect(url).not.toContain("e2e=1");
  });

  it("does not reload when the build is current, already tagged, or unusable", async () => {
    const replace = vi.fn();
    setEnv({
      PROD: true,
      VITE_E2E: "false",
      VITE_BUILD_ID: "same",
      BASE_URL: "/",
    });
    vi.stubGlobal("window", {
      location: { href: "https://example.com/?b=same", replace },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    await ensureFreshBuild();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ buildId: "same" }),
      })),
    );
    await ensureFreshBuild();

    setEnv({
      PROD: true,
      VITE_E2E: "false",
      VITE_BUILD_ID: "old",
      BASE_URL: "/",
    });
    vi.stubGlobal("window", {
      location: { href: "https://example.com/?b=new", replace },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ buildId: "new" }),
      })),
    );
    await ensureFreshBuild();

    vi.stubGlobal("window", {
      location: { href: "https://example.com/", replace },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({}),
      })),
    );
    await ensureFreshBuild();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await ensureFreshBuild();
    expect(replace).not.toHaveBeenCalled();
  });
});
