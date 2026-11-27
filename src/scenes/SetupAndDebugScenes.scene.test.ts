import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Phaser from "phaser";
import type { TownScene } from "./TownScene";
import type { EndlessModeSetupScene } from "./EndlessModeSetupScene";
import type { WavePlannerSetupScene } from "./WavePlannerSetupScene";
import {
  createDefenseSceneE2eHost,
  type DefenseSceneE2eHost,
} from "./defense/DefenseSceneE2EHost";
import { registerDefenseSceneE2eHostFactory } from "./defense/defenseSceneE2eHook";
import { getDataStore } from "../core/registryKeys";
import { isTownReachableReady } from "./loading/GameAssetLoader";
import { setShowTouchInput, showHitboxes } from "../debug/DebugState";
import { interactiveObjectScreenRect } from "../ui/touch/touchButton";
import {
  bootToTown,
  seedMathRandom,
  type TownBoot,
} from "../test/scene/townBoot";
import {
  findText,
  interactiveObjects,
  startNightFromTown,
  tapDefense,
  tapText,
  tapTown,
  waitForScene,
} from "../test/scene/sceneFlow";

const ENDLESS = "TownEndlessSetup";
const PLANNER = "TownWavePlannerSetup";

/** Tap every interactive object in `scene` except ones covering `skip` labels. */
function tapEveryControl(
  boot: TownBoot,
  scene: Phaser.Scene,
  skip: Phaser.GameObjects.Text[],
): number {
  const avoid = skip.map((t) => t.getBounds());
  let tapped = 0;
  for (const obj of interactiveObjects(scene)) {
    if (!obj.active) continue;
    const r = interactiveObjectScreenRect(obj);
    if (!r || r.width <= 0 || r.height <= 0) continue;
    const covers = avoid.some(
      (b) =>
        b.centerX >= r.x &&
        b.centerX <= r.x + r.width &&
        b.centerY >= r.y &&
        b.centerY <= r.y + r.height,
    );
    if (covers) continue;
    // Skip full-screen backdrops: tapping them only dismisses tooltips.
    if (r.width >= scene.scale.width && r.height >= scene.scale.height)
      continue;
    boot.h.tap(r.x + r.width / 2, r.y + r.height / 2);
    tapped++;
  }
  return tapped;
}

describe("Setup scenes + DebugMenu (real Phaser)", () => {
  let boot: TownBoot;
  let town: TownScene;
  const h = () => boot.h;
  const ready = () =>
    isTownReachableReady(h().game, getDataStore(town.registry));
  let releaseEnemySprites: (status?: number) => void = () => {};

  beforeAll(async () => {
    registerDefenseSceneE2eHostFactory(createDefenseSceneE2eHost);
    seedMathRandom(11);
    // Hold the night's enemy sprites so the Town prefetch is deterministically
    // still running for the loading-skeleton test.
    boot = await bootToTown({
      beforeBoot: (server) => {
        releaseEnemySprites = server.hold(/\/sprites\/enemies\//);
      },
    });
    town = boot.town;
  });

  afterAll(async () => {
    releaseEnemySprites();
    await boot?.teardown();
    registerDefenseSceneE2eHostFactory(null);
  });

  it("endless setup shows a loading skeleton before the prefetch, and its close works", async () => {
    expect(ready()).toBe(false);
    town.e2eOpenEndlessPanel();
    const setup = await waitForScene<EndlessModeSetupScene>(h(), ENDLESS);
    expect(setup.e2eIsLoading()).toBe(true);
    const close = setup.e2eGetUiTapTargets()["endless-close"];
    if (!close) throw new Error("no skeleton close");
    h().tap(close.x, close.y);
    h().step(3);
    expect(h().game.scene.isActive(ENDLESS)).toBe(false);
    releaseEnemySprites();
    await h().stepUntil(ready, { maxFrames: 3000 });
  });

  it("endless panel: roster, selection, caps, infinite HP, scroll, touch debug, close", async () => {
    town.e2eOpenEndlessPanel();
    const setup = await waitForScene<EndlessModeSetupScene>(h(), ENDLESS);
    expect(setup.e2eIsOpen()).toBe(true);
    expect(setup.e2eIsLoading()).toBe(false);
    const roster = setup.e2eEndlessRosterEnemyIds();
    expect(roster.length).toBeGreaterThan(1);
    const [a, b] = roster as [string, string];
    setup.e2eToggleEndlessEnemy(b);
    expect(setup.e2eEndlessSelectedEnemyIds()).toContain(b);
    setup.e2eSetEndlessEnemyCap(b, 3);
    expect(setup.e2eEndlessEnemyConcurrentCap(b)).toBe(3);
    setup.e2eToggleEndlessEnemy(b);
    expect(setup.e2eEndlessSelectedEnemyId()).toBe(a);
    setup.e2eSetEndlessInfiniteHp(true);
    expect(setup.e2eEndlessInfiniteHpEnabled()).toBe(true);
    setup.e2eSetEndlessInfiniteHp(false);
    setup.e2eScrollEndlessEnemyList(400);
    expect(setup.e2eEndlessEnemyListScrollState()).not.toBeNull();
    setShowTouchInput(setup.registry, true);
    h().step(2);
    expect(setup.e2eTouchDebugRectCount()).toBeGreaterThan(0);
    setShowTouchInput(setup.registry, false);
    h().step(1);
    // Real taps on the panel's own controls.
    const t = setup.e2eGetUiTapTargets();
    for (const id of Object.keys(t)) {
      if (id === "endless-start" || id === "endless-close") continue;
      const p = setup.e2eGetUiTapTargets()[id];
      if (p) h().tap(p.x, p.y);
    }
    const close = setup.e2eGetUiTapTargets()["endless-close"];
    if (!close) throw new Error("no endless-close");
    h().tap(close.x, close.y);
    h().step(3);
    expect(h().game.scene.isActive(ENDLESS)).toBe(false);
  });

  it("endless panel dismissed from code, then started with infinite HP", async () => {
    town.e2eOpenEndlessPanel();
    let setup = await waitForScene<EndlessModeSetupScene>(h(), ENDLESS);
    setup.e2eDismiss();
    h().step(3);
    town.e2eOpenEndlessPanel();
    setup = await waitForScene<EndlessModeSetupScene>(h(), ENDLESS);
    const [first] = setup.e2eEndlessRosterEnemyIds();
    setup.e2eStartEndless(first as string, true);
    await h().stepUntil(() => h().game.scene.isActive("Defense"));
    const defense = h().game.scene.getScene("Defense") as Phaser.Scene & {
      e2e: DefenseSceneE2eHost;
    };
    await h().stepUntil(() => defense.e2e.isReady());
    expect(defense.e2e.isEndlessInfiniteHp()).toBe(true);
    defense.e2e.damagePlayer(1_000_000);
    h().step(5);
    expect(defense.e2e.nightEnded()).toBe(false);
    tapDefense(h(), defense as never, "defense-leave-endless");
    h().step(5);
    if (defense.e2e.hasReturnButton()) {
      tapDefense(h(), defense as never, "defense-return-to-town");
    }
    town = await waitForScene<TownScene>(h(), "Town");
  });

  it("wave planner panel: touch debug, controls, close", async () => {
    tapTown(h(), town, "town-building-town_special_plague_clinic");
    const setup = await waitForScene<WavePlannerSetupScene>(h(), PLANNER);
    expect(setup.e2eIsOpen()).toBe(true);
    setShowTouchInput(setup.registry, true);
    h().step(2);
    expect(setup.e2eTouchDebugRectCount()).toBeGreaterThan(0);
    setShowTouchInput(setup.registry, false);
    const close = setup.e2eGetUiTapTargets()["wave-planner-close"];
    if (!close) throw new Error("no wave-planner-close");
    h().tap(close.x, close.y);
    h().step(3);
    expect(h().game.scene.isActive(PLANNER)).toBe(false);
  });

  it("DebugMenu from Town: every toggle / segment / info button responds", async () => {
    tapText(h(), town, "Debug");
    const menu = await waitForScene(h(), "DebugMenu");
    const footer = [findText(menu, "Close")].filter(
      (t): t is Phaser.GameObjects.Text => t !== null,
    );
    const before = showHitboxes(menu.registry);
    setShowTouchInput(menu.registry, true);
    h().step(2);
    setShowTouchInput(menu.registry, false);
    // Every toggle flips, segments switch, info buttons open tooltips.
    expect(tapEveryControl(boot, menu, footer)).toBeGreaterThan(10);
    expect(showHitboxes(menu.registry)).toBe(!before);
    // Second pass (tooltips toggle closed, settings flip back).
    tapEveryControl(boot, menu, footer);
    tapText(h(), menu, "Close");
    await h().stepUntil(() => !h().game.scene.isActive("DebugMenu"));
  });

  it("DebugMenu from a paused night: Go to town leaves the night", async () => {
    const defense = await startNightFromTown(h(), town);
    tapDefense(h(), defense, "defense-debug");
    const menu = await waitForScene(h(), "DebugMenu");
    expect(h().game.scene.isPaused("Defense")).toBe(true);
    tapText(h(), menu, "Go to town");
    town = await waitForScene<TownScene>(h(), "Town");
    expect(h().game.scene.isActive("DebugMenu")).toBe(false);
  });
});
