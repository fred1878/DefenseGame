import { describe, expect, it, vi } from "vitest";
import { asScene, fakeScene, type FakeGameObject } from "../../test/fakeScene";
import { createTownPlate } from "./townBuildingPlate";

const parts = [
  "uipart_da-plate-gold",
  "uipart_da-plate-grey",
  "uipart_da-gem-gold",
  "uipart_da-gem-grey",
];

describe("town name plate", () => {
  it("shows name, one gem per level (gold up to the current level) and Lv x/y", () => {
    const scene = fakeScene({ textures: parts });
    createTownPlate(
      asScene(scene),
      200,
      300,
      { name: "Witchlight Beacon", level: 3, maxLevel: 8, action: "Wall" },
      20,
    );
    const texts = scene.made("text").map((t) => t.last("setText")?.[0]);
    expect(texts).toContain("Witchlight Beacon");
    expect(texts).toContain("Lv 3/8");
    expect(texts).toContain("Wall");
    const gems = scene
      .made("image")
      .filter((i) => String(i.args[2]).includes("gem"));
    expect(gems).toHaveLength(8);
    expect(gems.filter((g) => g.args[2] === "uipart_da-gem-gold")).toHaveLength(
      3,
    );
    expect(scene.made("nineslice")).toHaveLength(1);
  });

  it("draws the upgrade arrow only when ready and swaps to the grey locked frame", () => {
    const scene = fakeScene({ textures: parts });
    const plate = createTownPlate(
      asScene(scene),
      700,
      300,
      {
        name: "Moon Brazier",
        level: 1,
        maxLevel: 3,
        action: "Blacksmith",
        upgradeReady: true,
      },
      20,
    );
    const badge = scene.made("graphics")[1] as FakeGameObject;
    expect(badge.callsTo("fillCircle").length).toBeGreaterThan(0);
    // Clamped inside the canvas (anchor 700 is off the right edge).
    const c = plate.container as unknown as FakeGameObject;
    expect(c.last("setX")?.[0] as number).toBeLessThan(540);

    plate.update({
      name: "Empty plot",
      action: "Unlocks at Town Lv 3",
      locked: true,
    });
    expect(scene.made("nineslice")).toHaveLength(2);
    expect(scene.made("nineslice")[0]!.destroyed).toBe(true);
    const lock = scene.made("graphics")[0] as FakeGameObject;
    expect(lock.callsTo("fillRect").length).toBeGreaterThan(0);

    const onTap = vi.fn();
    plate.makeTappable(onTap);
    expect(plate.container.input?.enabled).toBe(true);
    plate.moveTo(100, 50);
    expect(c.last("setY")).toEqual([50]);
  });

  it("hides its parts while baked and reports a key that tracks content", () => {
    const scene = fakeScene({ textures: parts });
    const plate = createTownPlate(
      asScene(scene),
      200,
      300,
      { name: "Haunted Well", action: "Endless" },
      20,
    );
    const k1 = plate.bakeKey();
    plate.setBaked(true);
    const kids = (plate.container as unknown as { list: FakeGameObject[] })
      .list;
    expect(kids.every((k) => k.visible === false)).toBe(true);
    expect(plate.container.visible).not.toBe(false);
    plate.setBaked(false);
    expect(kids.some((k) => k.visible !== false)).toBe(true);
    plate.update({ name: "Haunted Well", action: "Spells" });
    expect(plate.bakeKey()).not.toBe(k1);
  });
});
