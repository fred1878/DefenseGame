import { describe, expect, it } from "vitest";
import buildingsRaw from "../../../public/data/buildings.json";
import { gearFixture } from "../../test/gearFixture";
import { owned, panelSave } from "../../test/gearPanelFixture";
import { bagItems } from "../../gear/inventory";
import {
  dropVerdict,
  equipNightDrop,
  keptDropUids,
  nightDropCompare,
  nightDropRows,
  nightLossTips,
} from "./nightDropView";

const catalog = gearFixture();
const tough = { affixes: [{ id: "tough", value: 5 }] };
const vital = { affixes: [{ id: "vital", value: 4 }] };

function saveWith(
  worn: ReturnType<typeof owned>,
  drop: ReturnType<typeof owned>,
) {
  return panelSave(1, 100, [worn, drop], { helm: worn.uid });
}

describe("dropVerdict", () => {
  it("is New when the target slot is empty", () => {
    const s = panelSave(1, 100, [owned(1, "cap")]);
    expect(dropVerdict(catalog, s.gear, 1)).toBe("new");
  });
  it("is Same when nothing changes", () => {
    const s = saveWith(owned(1, "cap"), owned(2, "cap"));
    expect(dropVerdict(catalog, s.gear, 2)).toBe("same");
  });
  it("is Better / Worse when every changed stat moves one way", () => {
    expect(
      dropVerdict(
        catalog,
        saveWith(owned(1, "cap"), owned(2, "cap", vital)).gear,
        2,
      ),
    ).toBe("better");
    expect(
      dropVerdict(
        catalog,
        saveWith(owned(1, "cap", vital), owned(2, "cap")).gear,
        2,
      ),
    ).toBe("worse");
  });
  it("is Mixed when some stats rise and some fall", () => {
    const s = saveWith(owned(1, "cap", tough), owned(2, "cap", vital));
    expect(dropVerdict(catalog, s.gear, 2)).toBe("mixed");
  });
});

describe("night drop rows", () => {
  it("finds drops kept this night by uid", () => {
    const before = { items: [owned(1, "cap")], equipped: {}, nextUid: 5 };
    const after = {
      items: [owned(1, "cap"), owned(6, "band"), owned(5, "blade")],
      equipped: {},
      nextUid: 7,
    };
    expect(keptDropUids(before, after)).toEqual([5, 6]);
  });

  it("equip is a swap and keeps working with a full bag", () => {
    const s = saveWith(owned(1, "cap"), owned(2, "cap", vital));
    const bagBefore = bagItems(s.gear).length;
    const next = equipNightDrop(catalog, s, 2);
    expect(next.gear.equipped.helm).toBe(2);
    expect(bagItems(next.gear).map((i) => i.uid)).toEqual([1]);
    expect(bagItems(next.gear).length).toBe(bagBefore);
    const [row] = nightDropRows(catalog, next.gear, [2]);
    expect(row?.equipped).toBe(true);
  });

  it("rows carry name, verdict and the compare rows", () => {
    const s = saveWith(owned(1, "cap"), owned(2, "cap", vital));
    const [row] = nightDropRows(catalog, s.gear, [2]);
    expect(row).toMatchObject({ uid: 2, verdict: "better", equipped: false });
    expect(row?.sub).toContain("ilvl 1");
    const cmp = nightDropCompare(catalog, s.gear, 2);
    expect(cmp.rows.length).toBeGreaterThan(0);
    expect(cmp.rows.every((r) => r.better)).toBe(true);
  });
});

describe("nightLossTips", () => {
  const base = {
    catalog,
    buildings: buildingsRaw,
    wallHpPerLevel: 20,
    wallBuildingName: "Witchlight Beacon",
    blacksmithName: "Moon Brazier",
    traderName: "Market Stall",
  };
  it("uses the real next wall cost and HP step", () => {
    const save = panelSave(3, 10);
    const tips = nightLossTips({ ...base, save });
    expect(tips[0]?.title).toBe("Raise the wall");
    expect(tips[0]?.body).toContain("+20 wall HP");
    expect(tips[0]?.body).toContain(`${buildingsRaw.wall.costByLevel[0]}g`);
    expect(tips).toHaveLength(2);
  });
  it("points at better bag items and affordable shop upgrades", () => {
    const save = saveWith(owned(1, "cap"), owned(2, "cap", vital));
    save.buildings = { wall: buildingsRaw.wall.maxLevel };
    save.gold = 1000;
    const tips = nightLossTips({ ...base, save });
    expect(tips.map((t) => t.title)).toEqual([
      "Wear your best gear",
      "Upgrade the Blacksmith",
    ]);
    expect(tips[1]?.body).toContain(
      `${buildingsRaw.blacksmith.costByLevel[0]}g`,
    );
  });
});

describe("night drop edge cases", () => {
  it("treats a missing item as Same and skips unknown rows", () => {
    const s = panelSave(1, 100, [owned(1, "cap")]);
    expect(dropVerdict(catalog, s.gear, 99)).toBe("same");
    expect(nightDropRows(catalog, s.gear, [99])).toEqual([]);
  });

  it("equipping an unknown uid leaves the save untouched", () => {
    const s = panelSave(1, 100, [owned(1, "cap")]);
    expect(equipNightDrop(catalog, s, 99)).toBe(s);
  });

  it("falls back to visiting the Blacksmith when nothing else applies", () => {
    const save = saveWith(owned(1, "cap"), owned(2, "cap", vital));
    save.buildings = {
      wall: buildingsRaw.wall.maxLevel,
      blacksmith: buildingsRaw.blacksmith.maxLevel,
      trader: buildingsRaw.trader.maxLevel,
    };
    save.gold = 7;
    const tips = nightLossTips({
      catalog,
      buildings: buildingsRaw,
      wallHpPerLevel: 20,
      wallBuildingName: "Beacon",
      blacksmithName: "Moon Brazier",
      traderName: "Market Stall",
      save,
    });
    expect(tips.map((t) => t.title)).toEqual([
      "Wear your best gear",
      "Visit the Blacksmith",
    ]);
    expect(tips[0]?.body).toBe("1 item in your bag beats what you wear");
  });

  it("uses the wall cost when the wall cannot be afforded and handles missing defs", () => {
    const save = panelSave(1, 0);
    const tips = nightLossTips({
      catalog,
      buildings: { wall: buildingsRaw.wall },
      wallHpPerLevel: 20,
      wallBuildingName: "Beacon",
      blacksmithName: "Moon Brazier",
      traderName: "Market Stall",
      save,
    });
    expect(tips[0]?.body).toContain(`${buildingsRaw.wall.costByLevel[0]}g`);
    expect(tips).toHaveLength(2);
  });
});
