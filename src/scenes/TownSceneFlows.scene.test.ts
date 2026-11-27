import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Phaser from "phaser";
import type { TownScene } from "./TownScene";
import type { DefenseScene } from "./DefenseScene";
import {
  createDefenseSceneE2eHost,
  type DefenseSceneE2eHost,
} from "./defense/DefenseSceneE2EHost";
import { registerDefenseSceneE2eHostFactory } from "./defense/defenseSceneE2eHook";
import { getDataStore, getSave } from "../core/registryKeys";
import { isTownReachableReady } from "./loading/GameAssetLoader";
import { setShowTouchInput } from "../debug/DebugState";
import {
  bootToTown,
  seedMathRandom,
  type TownBoot,
} from "../test/scene/townBoot";
import {
  tapDefense,
  tapText,
  tapTown,
  textsUnder,
  waitForDefense,
  waitForScene,
} from "../test/scene/sceneFlow";

type SetupScene = Phaser.Scene & {
  e2eGetUiTapTargets(): Record<string, { x: number; y: number }>;
  e2eIsOpen(): boolean;
};

/** Town buildings, panels, setup scenes and the endless / wave planner runs. */
describe("TownScene flows (real Phaser)", () => {
  let boot: TownBoot;
  let town: TownScene;
  const h = () => boot.h;

  /** Restart Town (runs its shutdown + create again) and wait for it. */
  const restartTown = async () => {
    town.scene.restart();
    h().step(2);
    town = await waitForScene<TownScene>(h(), "Town");
  };

  beforeAll(async () => {
    registerDefenseSceneE2eHostFactory(createDefenseSceneE2eHost);
    seedMathRandom(3);
    boot = await bootToTown({ save: (s) => ({ ...s, gold: 5000 }) });
    town = boot.town;
    // Town prefetch (night assets, data, lazy scenes) done, so panels and
    // transitions open synchronously like they do for a settled player.
    await h().stepUntil(
      () => isTownReachableReady(h().game, getDataStore(town.registry)),
      { maxFrames: 3000 },
    );
  });

  afterAll(async () => {
    await boot?.teardown();
    registerDefenseSceneE2eHostFactory(null);
  });

  it("upgrading the wall spends gold, relabels the building and flashes status", () => {
    const gold0 = getSave(town.registry).gold;
    tapTown(h(), town, "town-building-town_special_witchlight_beacon");
    h().step(2);
    expect(getSave(town.registry).gold).toBeLessThan(gold0);
    const status = (town as unknown as { statusText: Phaser.GameObjects.Text })
      .statusText;
    const flashed = status.text;
    h().step(60 * 10);
    expect(status.text).not.toBe(flashed);
    expect(status.text).toContain("Wall L1");
  });

  it("spell bar building opens the sort panel", async () => {
    tapTown(h(), town, "town-building-town_special_witchlight_beacon_daylit");
    h().step(2);
    expect(town.e2eIsSpellSortPanelOpen()).toBe(true);
    expect(town.e2eGetSpellSortBarSlots().length).toBe(8);
    expect(town.e2eGetSpellSortSlotHitRects().length).toBeGreaterThan(0);
    await restartTown();
    expect(town.e2eIsSpellSortPanelOpen()).toBe(false);
    town.e2eOpenSpellSortPanel();
    expect(town.e2eIsSpellSortPanelOpen()).toBe(true);
    await restartTown();
  });

  it("blacksmith and trader open shops (stocking persists via gear change)", async () => {
    tapTown(h(), town, "town-building-town_special_moon_brazier");
    h().step(2);
    // Opening a shop rolls stock and persists it through applyGearChange.
    expect(getSave(town.registry).shops.blacksmith).toBeDefined();
    await restartTown();
    tapTown(h(), town, "town-building-town_market_stall");
    h().step(2);
    await restartTown();
    tapTown(h(), town, "town-talents");
    h().step(2);
    await restartTown();
  });

  it("save menu: save to a slot, then load it (Town restarts on that save)", async () => {
    tapTown(h(), town, "town-building-town_market_stall_daylit");
    h().step(2);
    const targets = () => town.e2eGetUiTapTargets();
    expect(targets()["save-menu-slot-0"]).toBeDefined();
    tapTown(h(), town, "save-menu-slot-0");
    tapTown(h(), town, "save-menu-save");
    if (targets()["save-menu-confirm"]) tapTown(h(), town, "save-menu-confirm");
    h().step(2);
    tapTown(h(), town, "save-menu-slot-0");
    tapTown(h(), town, "save-menu-load");
    if (targets()["save-menu-confirm"]) tapTown(h(), town, "save-menu-confirm");
    h().step(5);
    town = await waitForScene<TownScene>(h(), "Town");
    expect(getSave(town.registry).gold).toBeGreaterThan(0);
  });

  it("touch-input debug overlay draws town hit rects", () => {
    setShowTouchInput(town.registry, true);
    h().step(3);
    expect(town.e2eTownTouchDebugRectCount()).toBeGreaterThan(0);
    expect(town.e2eTownBuildingDebugRectCount()).toBeGreaterThan(0);
    expect(town.e2eIsTouchButtonPressed("start-night")).toBe(false);
    setShowTouchInput(town.registry, false);
    h().step(1);
  });

  it("Debug header button opens the DebugMenu over Town", async () => {
    tapText(h(), town, "Debug");
    const menu = await waitForScene(h(), "DebugMenu");
    tapText(h(), menu, "Close");
    await h().stepUntil(() => !h().game.scene.isActive("DebugMenu"));
    expect(h().game.scene.isActive("Town")).toBe(true);
  });

  it("endless training: start from the setup scene, respawn, leave back to Town", async () => {
    tapTown(h(), town, "town-building-town_special_haunted_well");
    const setup = await waitForScene<SetupScene>(h(), "TownEndlessSetup");
    await h().stepUntil(
      () => Boolean(setup.e2eGetUiTapTargets()["endless-start"]),
      { maxFrames: 600 },
    );
    const start = setup.e2eGetUiTapTargets()["endless-start"];
    if (!start) throw new Error("no endless-start");
    h().tap(start.x, start.y);
    const defense = await waitForDefense(h());
    const e2e = defense.e2e as DefenseSceneE2eHost;
    expect(e2e.isEndlessMode()).toBe(true);
    h().step(60);
    const n = e2e.enemyCount();
    expect(n).toBeGreaterThan(0);
    e2e.killAllEnemies();
    h().step(10);
    expect(e2e.enemyCount()).toBeGreaterThan(0);
    tapDefense(h(), defense, "defense-leave-endless");
    h().step(5);
    if (e2e.hasReturnButton())
      tapDefense(h(), defense, "defense-return-to-town");
    town = await waitForScene<TownScene>(h(), "Town");
  });

  it("endless run ends when the player dies", async () => {
    town.e2eStartEndless("grunt");
    const defense = await waitForDefense(h());
    const e2e = defense.e2e as DefenseSceneE2eHost;
    e2e.setManualReturn(true);
    e2e.damagePlayer(1_000_000);
    h().step(5);
    expect(e2e.nightEnded()).toBe(true);
    defense.leaveTrainingRun(); // no-op once ended
    defense.endEndlessRun("quit"); // no-op once ended
    tapDefense(h(), defense, "defense-return-to-town");
    town = await waitForScene<TownScene>(h(), "Town");
  });

  it("wave planner: start a planned wave from the setup scene, then leave", async () => {
    tapTown(h(), town, "town-building-town_special_plague_clinic");
    const setup = await waitForScene<SetupScene>(h(), "TownWavePlannerSetup");
    await h().stepUntil(
      () => Boolean(setup.e2eGetUiTapTargets()["wave-planner-start"]),
      { maxFrames: 600 },
    );
    const start = setup.e2eGetUiTapTargets()["wave-planner-start"];
    if (!start) throw new Error("no wave-planner-start");
    h().tap(start.x, start.y);
    const defense: DefenseScene = await waitForDefense(h());
    expect(defense.isWavePlannerMode()).toBe(true);
    h().step(120);
    defense.leaveTrainingRun();
    h().step(5);
    if ((defense.e2e as DefenseSceneE2eHost).hasReturnButton()) {
      tapDefense(h(), defense, "defense-return-to-town");
    }
    town = await waitForScene<TownScene>(h(), "Town");
    expect(
      textsUnder(town.children.list[0] as Phaser.GameObjects.GameObject),
    ).toBeDefined();
  });

  it("e2eStartNight goes straight to the Defense scene", async () => {
    town.e2eStartNight();
    await waitForDefense(h());
  });
  it("a fully upgraded town reads as the max growth stage", async () => {
    const save = getSave(town.registry);
    save.buildings = { ...save.buildings, wall: 8, trader: 3, blacksmith: 3 };
    await restartTown();
    const texts = town.children.list.flatMap(textsUnder);
    expect(texts).toContain("Town Lv 6");
    expect(texts.some((t) => t.includes("Max stage"))).toBe(true);
  });
});
