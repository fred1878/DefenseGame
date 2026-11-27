import { describe, expect, it } from "vitest";
import type { TownBakeArt } from "./TownBuildings";
import { createTownPlate } from "../../ui/hud/townBuildingPlate";
import { asScene, fakeScene, type FakeGameObject } from "../../test/fakeScene";
import { TOWN_ISO_STAGES } from "../../world/townIso/townIsoStageData";
import { TownIsoWorld } from "./TownIsoWorld";

describe("TownIsoWorld", () => {
  it("builds ground, scenery, lights, smoke and the locked plot per stage", () => {
    const scene = fakeScene();
    const world = new TownIsoWorld(asScene(scene));
    world.build(0, 3);
    expect(world.stage).toBe(0);
    const rt = scene.made("renderTexture")[0] as FakeGameObject;
    expect(rt.callsTo("stamp").length).toBeGreaterThan(1500);
    expect(rt.callsTo("render")).toHaveLength(1);
    const dim = scene.made("image").filter((i) => i.args[2] === "town_iso_dim");
    expect(dim).toHaveLength(TOWN_ISO_STAGES[0]!.scenery.length);
    const lights = scene
      .made("image")
      .filter((i) => i.args[2] === "town_iso_light");
    expect(lights).toHaveLength(TOWN_ISO_STAGES[0]!.lights.length);
    expect(
      scene
        .made("text")
        .some((t) => t.last("setText")?.[0] === "Unlocks at Town Lv 3"),
    ).toBe(true);

    // Same stage + hint: nothing rebuilt.
    const made = scene.created.length;
    world.build(0, 3);
    expect(scene.created.length).toBe(made);

    world.build(2, null);
    expect(rt.destroyed).toBe(true);
    const smoke = scene
      .made("image")
      .filter((i) => i.args[2] === "town_iso_smoke" && !i.destroyed);
    expect(smoke.length).toBe(TOWN_ISO_STAGES[2]!.smoke.length * 7);
    const puff = smoke[0]!;
    const y0 = puff.y;
    world.tick(500);
    expect(puff.y).not.toBe(y0);

    world.destroy();
    expect(world.stage).toBeNull();
    expect(puff.destroyed).toBe(true);
  });

  it("bakes the static world, building art and plates into one layer and hides them", () => {
    const scene = fakeScene();
    const world = new TownIsoWorld(asScene(scene));
    world.build(1, 5);
    const phaser = asScene(scene);
    const sprite = phaser.add.image(0, 0, "town_iso_lit", "watchtower");
    const container = phaser.add.container(10, 10).setDepth(1.5);
    const shadow = phaser.add.image(0, 0, "town_iso_light").setDepth(0.5);
    const plate = createTownPlate(
      asScene(scene),
      100,
      100,
      { name: "Beacon", action: "Wall", level: 1, maxLevel: 8 },
      20,
    );
    const art = {
      key: "beacon:watchtower",
      sprite,
      container,
      shadow,
      plate,
    } as unknown as TownBakeArt;
    world.bake([art]);
    const rts = scene.made("renderTexture");
    const bake = rts.at(-1) as FakeGameObject;
    expect(bake.args.slice(2, 4)).toEqual([540, 1200]);
    const drawn = bake.callsTo("draw").map(([o]) => o);
    expect(drawn).toContain(container);
    expect(drawn).toContain(shadow);
    // Plates go on top of the world.
    expect(drawn.indexOf(plate.container)).toBeGreaterThan(
      drawn.indexOf(container),
    );
    expect(drawn.indexOf(shadow)).toBeLessThan(drawn.indexOf(container));
    expect(bake.callsTo("render")).toHaveLength(1);
    expect((sprite as unknown as FakeGameObject).visible).toBe(false);
    expect((shadow as unknown as FakeGameObject).visible).toBe(false);
    // Containers stay visible so their hit areas keep working.
    expect((container as unknown as FakeGameObject).visible).not.toBe(false);
    const dim = scene.made("image").find((i) => i.args[2] === "town_iso_dim");
    expect(dim?.visible).toBe(false);

    // Nothing changed: no redraw. A plate change is picked up on the next tick.
    world.bake([art]);
    world.tick(16);
    expect(bake.callsTo("render")).toHaveLength(1);
    plate.update({ name: "Beacon", action: "Wall", level: 2, maxLevel: 8 });
    world.tick(16);
    expect(bake.callsTo("render")).toHaveLength(2);

    world.destroy();
    expect(bake.destroyed).toBe(true);
  });
});
