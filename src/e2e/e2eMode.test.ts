import { afterEach, describe, expect, it, vi } from "vitest";
import {
  E2E_SAVE_STORAGE_KEY,
  e2eCampaignWavesFromQuery,
  e2eManualReturnFromQuery,
  isE2EEnabled,
  saveStorageKey,
} from "./e2eMode";

describe("e2eMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is enabled when VITE_E2E is true", () => {
    vi.stubEnv("VITE_E2E", "true");
    expect(isE2EEnabled()).toBe(true);
    expect(saveStorageKey()).toBe(E2E_SAVE_STORAGE_KEY);
  });

  it("is disabled without window when the env flag is off", () => {
    vi.stubEnv("VITE_E2E", "false");
    vi.stubGlobal("window", undefined);
    expect(isE2EEnabled()).toBe(false);
    expect(saveStorageKey()).toBe("defensegame_save_v1");
    expect(e2eManualReturnFromQuery()).toBe(false);
    expect(e2eCampaignWavesFromQuery()).toBe(false);
  });

  it("reads e2e and manualReturn from the query string", () => {
    vi.stubEnv("VITE_E2E", "false");
    vi.stubGlobal("window", {
      location: {
        href: "http://localhost/?e2e=1&manualReturn=1&campaignWaves=1",
      },
    });
    expect(isE2EEnabled()).toBe(true);
    expect(e2eManualReturnFromQuery()).toBe(true);
    expect(e2eCampaignWavesFromQuery()).toBe(true);
  });

  it("ignores other query values", () => {
    vi.stubEnv("VITE_E2E", "false");
    vi.stubGlobal("window", {
      location: {
        href: "http://localhost/?e2e=0&manualReturn=0&campaignWaves=0",
      },
    });
    expect(isE2EEnabled()).toBe(false);
    expect(e2eManualReturnFromQuery()).toBe(false);
    expect(e2eCampaignWavesFromQuery()).toBe(false);
  });
});
