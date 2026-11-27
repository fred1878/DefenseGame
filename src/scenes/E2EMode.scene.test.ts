import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  bootToTown,
  seedMathRandom,
  type TownBoot,
} from "../test/scene/townBoot";
import { waitForDefense, waitForScene } from "../test/scene/sceneFlow";
import type { DefenseGameE2EApi } from "../e2e/e2eGlobal";

/**
 * The game in E2E mode (VITE_E2E=true, as the Playwright build): scenes take
 * their E2E branches (empty campaign field, published state) and the
 * `window.__DEFENSEGAME_E2E__.api` drives them like Playwright does.
 */
describe("E2E mode (real Phaser)", () => {
  let boot: TownBoot;
  let api: DefenseGameE2EApi;
  const h = () => boot.h;
  const state = () =>
    (window as unknown as { __DEFENSEGAME_E2E__: { scene?: string } })
      .__DEFENSEGAME_E2E__;

  beforeAll(async () => {
    seedMathRandom(9);
    vi.stubEnv("VITE_E2E", "true");
    const { seedE2EWindowStub } = await import("../e2e/e2eGlobal");
    seedE2EWindowStub();
    boot = await bootToTown();
    vi.stubEnv("VITE_E2E", "true"); // bootToTown stubs BASE_URL; keep E2E on
    const { attachE2EGame } = await import("../e2e/installE2E");
    attachE2EGame(h().game);
    api = (
      window as unknown as { __DEFENSEGAME_E2E__: { api: DefenseGameE2EApi } }
    ).__DEFENSEGAME_E2E__.api;
    await h().stepUntil(() => !boot.town.load.isLoading(), { maxFrames: 3000 });
  });

  afterAll(async () => {
    const { unsubscribeE2EGameEvents } = await import("../e2e/installE2E");
    unsubscribeE2EGameEvents();
    await boot?.teardown();
    vi.unstubAllEnvs();
  });

  it("publishes Town, then runs a night through the E2E API", async () => {
    h().step(2);
    expect(state().scene).toBe("Town");
    api.startNight();
    await waitForDefense(h());
    h().step(10);
    expect(state().scene).toBe("Defense");
    api.setGodMode(true);
    api.spawnTestEnemy(60, 0);
    api.tapMelee();
    h().step(60);
    api.tapRanged();
    h().step(60);
    expect(api.getCombatTally()).toBeDefined();
    api.setManualReturnToTown(true);
    api.forceWinNight();
    h().step(5);
    expect(api.nightEnded()).toBe(true);
    api.returnToTown();
    await waitForScene(h(), "Town");
  });

  it("endless and campaign-wave E2E branches", async () => {
    api.startEndless("grunt");
    await waitForDefense(h());
    h().step(30);
    expect(api.getEnemyCount()).toBeGreaterThan(0);
    api.killAllEnemies();
    h().step(10);
    api.setManualReturnToTown(true);
    api.damagePlayer(1_000_000);
    h().step(5);
    api.returnToTown();
    await waitForScene(h(), "Town");
  });
});
