import { describe, expect, it } from "vitest";
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
});
