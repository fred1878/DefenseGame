import { describe, expect, it, vi } from "vitest";
import type { TownBuildingDef } from "../core/townBuildingTypes";
import { asScene, fakeScene, type FakeGameObject } from "../test/fakeScene";
import { TOWN_ISO_SPRITES } from "../world/townIso/townIsoStageData";
import type { TownIsoBuildingTier } from "../world/townIso/townIsoTypes";
import {
  spawnTownBuildingControls,
  townBuildingFootScreen,
  townBuildingTapBox,
  type TownBuildingView,
} from "./TownBuildings";

const tower: TownIsoBuildingTier = {
  key: "watchtower",
  dx: 0,
  dy: 120,
  footprint: [2, 2],
};
const hall: TownIsoBuildingTier = {
  key: "market_hall",
  dx: 0,
  dy: 0,
  footprint: [5, 7],
};
const market: TownBuildingDef = {
  label: "Night Market",
  width: 64,
  height: 64,
  opensShop: "trader",
};
const gallows: TownBuildingDef = {
  label: "Gallows Square",
  width: 96,
  height: 56,
  startsNight: true,
};

const view = (tier: TownIsoBuildingTier, name = "X"): TownBuildingView => ({
  tier,
  plate: { name, action: "Trader", level: 1, maxLevel: 3 },
});

describe("town building tap box", () => {
  it("covers the tier sprite (minus side insets) above the foot", () => {
    const [ax, ay, w, h] = TOWN_ISO_SPRITES.market_hall!;
    const box = townBuildingTapBox(hall, market, 0.6);
    expect(box.height).toBeCloseTo(h * 0.6);
    expect(box.y + box.height).toBeCloseTo((h - ay) * 0.6);
    expect(box.width).toBeCloseTo(w * 0.6 * 0.7);
    expect(box.x + box.width / 2).toBeCloseTo(((w - ax) * 0.6 - ax * 0.6) / 2);
  });

  it("never shrinks below the building's minimum tap size", () => {
    const tiny: TownBuildingDef = { ...market, width: 400, height: 500 };
    const box = townBuildingTapBox(tower, tiny, 0.6);
    expect(box.width).toBe(400);
    expect(box.height).toBe(500);
    const unknown = townBuildingTapBox({ ...tower, key: "nope" }, market, 0.6);
    expect(unknown.width).toBe(64);
  });

  it("offsets the foot by the tier's world offset at town scale", () => {
    const foot = townBuildingFootScreen({ x: 270, y: 415.2 }, tower);
    expect(foot.x).toBeCloseTo(270);
    expect(foot.y).toBeCloseTo(415.2 + 120 * 0.6);
    expect(foot.worldY).toBeCloseTo(1032);
  });
});

describe("spawnTownBuildingControls", () => {
  it("skips unknown buildings and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const scene = fakeScene();
    const controls = spawnTownBuildingControls(
      asScene(scene),
      { market },
      {
        buildingDisplayScale: 1,
        slots: [
          { buildingId: "missing", x: 0, y: 0 },
          { buildingId: "market", x: 97.2, y: 732 },
        ],
      },
      { viewFor: () => view(hall), onTap: vi.fn() },
    );
    expect(controls).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("draws lit art with a contact shadow and a plate, and swaps tiers", () => {
    const scene = fakeScene({
      textures: ["uipart_da-plate-gold", "uipart_da-plate-grey"],
    });
    const onTap = vi.fn();
    const [c] = spawnTownBuildingControls(
      asScene(scene),
      { market },
      {
        buildingDisplayScale: 1,
        slots: [{ buildingId: "market", x: 97.2, y: 732 }],
      },
      { viewFor: () => view(tower, "Night Market"), onTap },
    );
    const control = c!;
    const sprite = scene
      .made("image")
      .find((i) => i.args[2] === "town_iso_lit") as FakeGameObject;
    expect(sprite.args[3]).toBe("watchtower");
    // No outline / glow: the only extra image under the building is the dark contact shadow.
    const shadow = scene
      .made("image")
      .find((i) => i.args[2] === "town_iso_light") as FakeGameObject;
    expect(shadow.last("setTint")).toEqual([0x000000]);
    expect(
      scene.made("text").some((t) => t.last("setText")?.[0] === "Night Market"),
    ).toBe(true);

    const before = control.spriteCenter();
    control.update(view(hall, "Night Market"));
    expect(sprite.last("setTexture")).toEqual(["town_iso_lit", "market_hall"]);
    const after = control.spriteCenter();
    expect(after.y).not.toBeCloseTo(before.y);
    const box = control.container.input?.hitArea as Phaser.Geom.Rectangle;
    expect(box.height).toBeCloseTo(TOWN_ISO_SPRITES.market_hall![3] * 0.6);

    const art = control.bakeArt();
    expect(art.key).toBe("market:market_hall");
    expect(art.sprite).toBe(sprite);
    expect(art.shadow).toBe(shadow);
    control.setInputEnabled(false);
    expect(control.container.input?.enabled).toBe(false);
    control.setInputEnabled(true);
    expect(control.container.input?.enabled).toBe(true);
  });

  it("uses the start-night test id for night-starting buildings", () => {
    const scene = fakeScene();
    const controls = spawnTownBuildingControls(
      asScene(scene),
      { gallows },
      {
        buildingDisplayScale: 1,
        slots: [{ buildingId: "gallows", x: 270, y: 856.8 }],
      },
      {
        viewFor: () => view({ ...hall, key: "stage", footprint: [3, 2] }),
        onTap: vi.fn(),
      },
    );
    const container = controls[0]!.container as unknown as FakeGameObject;
    expect(container.last("setData")).toEqual(["testid", "start-night"]);
  });
});
