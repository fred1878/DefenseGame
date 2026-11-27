import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TownScene } from "./TownScene";
import type { EndlessModeSetupScene } from "./EndlessModeSetupScene";
import type { WavePlannerSetupScene } from "./WavePlannerSetupScene";
import type { StaticServer } from "../test/scene/staticServer";
import { getDataStore } from "../core/registryKeys";
import { isTownReachableReady } from "./loading/GameAssetLoader";
import {
  bootToTown,
  seedMathRandom,
  type TownBoot,
} from "../test/scene/townBoot";
import {
  findText,
  tapText,
  tapTown,
  waitForScene,
} from "../test/scene/sceneFlow";

const ENDLESS = "TownEndlessSetup";
const PLANNER = "TownWavePlannerSetup";
const ENEMY_SPRITES = /\/sprites\/enemies\//;

/** Night assets fail to load: Town, endless and wave planner show the fatal panel, Retry recovers. */
describe("Setup scenes when the night assets fail to load (real Phaser)", {
  timeout: 60_000,
}, () => {
  let boot: TownBoot;
  let town: TownScene;
  let server: StaticServer;
  let fail: (status?: number) => void = () => {};
  const h = () => boot.h;
  const ready = () =>
    isTownReachableReady(h().game, getDataStore(town.registry));
  const spriteRequests = () =>
    server.requests.filter((r) => ENEMY_SPRITES.test(r)).length;
  const settle = async () => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 0));
      h().step(1);
    }
  };

  beforeAll(async () => {
    seedMathRandom(13);
    boot = await bootToTown({
      beforeBoot: (s) => {
        server = s;
        fail = s.hold(ENEMY_SPRITES);
      },
    });
    town = boot.town;
  });

  afterAll(async () => {
    fail();
    await boot?.teardown();
  });

  it("endless: skeleton, then the fatal panel; Close leaves the setup scene", async () => {
    expect(ready()).toBe(false);
    town.e2eOpenEndlessPanel();
    const setup = await waitForScene<EndlessModeSetupScene>(h(), ENDLESS);
    await h().stepUntil(() => spriteRequests() > 0, { timeoutMs: 20_000 });
    fail(404);
    await h().stepUntil(
      () => findText(setup, "Could not load endless roster") !== null,
      { timeoutMs: 20_000 },
    );
    expect(ready()).toBe(false);
    tapText(h(), setup, "Close");
    await settle();
    expect(h().game.scene.isActive(ENDLESS)).toBe(false);
  });

  it("wave planner: fatal panel, then Retry loads and opens the planner", async () => {
    // Town's own prefetch failed too; its Retry runs once assets serve again.
    fail = server.hold(ENEMY_SPRITES);
    const before = spriteRequests();
    tapTown(h(), town, "town-building-town_special_plague_clinic");
    const setup = await waitForScene<WavePlannerSetupScene>(h(), PLANNER);
    // Fail only once the retried sprite requests are actually being held.
    await h().stepUntil(() => spriteRequests() > before, { timeoutMs: 20_000 });
    fail(404);
    await h().stepUntil(
      () => findText(setup, "Could not load the wave planner") !== null,
      { timeoutMs: 20_000 },
    );
    tapText(h(), setup, "Retry");
    await h().stepUntil(() => setup.e2eIsOpen(), { timeoutMs: 20_000 });
    expect(ready()).toBe(true);
    const close = setup.e2eGetUiTapTargets()["wave-planner-close"];
    if (!close) throw new Error("no wave-planner-close");
    h().tap(close.x, close.y);
    await settle();
    expect(h().game.scene.isActive(PLANNER)).toBe(false);
    if (findText(town, "Retry")) tapText(h(), town, "Retry");
    await settle();
  });
});
