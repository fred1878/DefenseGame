import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Phaser from "phaser";
import type { TownScene } from "./TownScene";
import { getSave } from "../core/registryKeys";
import { TOWN_ISO_ATLAS } from "../content/townIsoAssets";
import { blocksBaseLayerInput } from "../input/inputModality";
import { tuning } from "../tuning/gameTuning";
import { interactiveObjectScreenRect } from "../ui/touch/touchButton";
import type { HeadlessGame } from "../test/scene/phaserHarness";
import type { StaticServer } from "../test/scene/staticServer";
import { bootToTown, type TownBoot } from "../test/scene/townBoot";

/** Private fields read through a structural view (tests only). */
type TownInternals = {
  resetButton: { container: Phaser.GameObjects.Container };
  statusText: Phaser.GameObjects.Text;
};

function textsUnder(obj: Phaser.GameObjects.GameObject): string[] {
  if (obj instanceof Phaser.GameObjects.Text) return [obj.text];
  if (obj instanceof Phaser.GameObjects.Container) {
    return obj.list.flatMap(textsUnder);
  }
  return [];
}

function center(obj: Phaser.GameObjects.GameObject): { x: number; y: number } {
  const r = interactiveObjectScreenRect(obj);
  if (!r) throw new Error("not interactive");
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

describe("TownScene (real Phaser, jsdom + canvas)", () => {
  let server: StaticServer;
  let h: HeadlessGame;
  let town: TownScene;
  let internals: TownInternals;
  let boot: TownBoot;

  beforeAll(async () => {
    boot = await bootToTown();
    ({ h, server } = boot);
    town = boot.town;
    internals = boot.town as unknown as TownInternals;
  });

  afterAll(() => boot?.teardown());

  it("boots Boot -> Town with shipped data and textures over HTTP", () => {
    expect(h.game.scene.isActive("Boot")).toBe(false);
    expect(internals.statusText.text).toContain("Night 1");
    expect(server.requests).toContain("/data/town_buildings.json");
    // A real texture decoded by the loader (not Phaser's __MISSING).
    const keys = h.game.textures.getTextureKeys();
    expect(keys.length).toBeGreaterThan(3);
    // The isometric town atlas (building art is packed, not one image per building).
    const key = keys.find((k) => k === TOWN_ISO_ATLAS.lit);
    expect(key).toBeDefined();
    const src = h.game.textures
      .get(key as string)
      .getSourceImage() as HTMLImageElement;
    expect(src.width).toBeGreaterThan(0);
    expect(src.height).toBeGreaterThan(0);
  });

  it("reset button arms on a real tap and disarms after the confirm window", () => {
    const labels = () => textsUnder(internals.resetButton.container);
    expect(labels()).toContain("Reset save");
    const { x, y } = center(internals.resetButton.container);
    h.tap(x, y);
    expect(labels()).toContain("Confirm reset");
    const windowMs = tuning("gameplay").feel.resetConfirmWindowMs;
    h.step(Math.floor(windowMs / (1000 / 60)) - 5);
    expect(labels()).toContain("Confirm reset");
    h.step(10);
    expect(labels()).toContain("Reset save");
  });

  it("tapping the Gear header button opens the gear panel (modal blocks base input)", () => {
    const gear = town.e2eGetUiTapTargets()["town-gear"];
    if (!gear) throw new Error("no gear button");
    const { x, y } = gear;
    h.tap(x, y);
    h.step(2);
    expect(blocksBaseLayerInput(town)).toBe(true);
    // Gear panel targets now merged into the tap map.
    expect(Object.keys(town.e2eGetUiTapTargets()).length).toBeGreaterThan(11);
    expect(getSave(town.registry).gold).toBe(0);
  });

  it("renders a real frame through Phaser's Canvas renderer", async () => {
    await h.stepUntil(() => !town.load.isLoading(), { maxFrames: 3000 });
    const png = h.renderPng();
    // PNG signature + a frame with real art and text is far above a blank one.
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.length).toBeGreaterThan(50_000);
    const out = process.env.SCENE_SNAPSHOT_DIR;
    if (out) {
      const fs = await import("node:fs");
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(`${out}/town.png`, png);
    }
  });
});
