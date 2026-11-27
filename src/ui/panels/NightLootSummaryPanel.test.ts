import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleNightLootSummary } from "../../gear/nightLootSummary";
import { gearFixture } from "../../test/gearFixture";
import { owned, panelSave } from "../../test/gearPanelFixture";
import { equipNightDrop } from "../gearPanel/nightDropView";
import { asScene, fakeScene, type FakeGameObject } from "../../test/fakeScene";
import {
  layoutNightLootSummary,
  NightLootSummaryPanel,
} from "./NightLootSummaryPanel";

const catalog = gearFixture();

function summaryWon() {
  return assembleNightLootSummary({
    won: true,
    night: 3,
    goldEarned: 40,
    goldTotal: 90,
    wallHp: 82,
    wallHpMax: 100,
    wallDamage: 18,
    drops: [
      { baseId: "cap", rarity: "magic", itemLevel: 2, affixes: [] },
      { baseId: "band", rarity: "rare", itemLevel: 3, affixes: [] },
    ],
    soldCount: 1,
    soldGold: 6,
    bagFreeSlots: 1,
    catalog,
  });
}

function summaryLostEmpty() {
  return assembleNightLootSummary({
    won: false,
    night: 2,
    goldEarned: 10,
    goldTotal: 10,
    wallHp: 0,
    wallHpMax: 100,
    wallDamage: 100,
    drops: [],
    soldCount: 0,
    soldGold: 0,
    bagFreeSlots: 4,
    catalog,
  });
}

function textsOf(scene: ReturnType<typeof fakeScene>): string[] {
  const out: string[] = [];
  for (const go of scene.made("text")) {
    const initial = go.args[2];
    if (typeof initial === "string" && initial) out.push(initial);
    for (const call of go.callsTo("setText")) {
      if (typeof call[0] === "string") out.push(call[0]);
    }
  }
  return out;
}

describe("NightLootSummaryPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a won summary with rarity-coloured loot and a return button", () => {
    const scene = fakeScene();
    const onReturn = vi.fn();
    const panel = new NightLootSummaryPanel(
      asScene(scene),
      summaryWon(),
      onReturn,
    );
    const labels = textsOf(scene);
    expect(labels).toContain("Night 3 defended!");
    expect(labels).toContain("Dawn breaks over the settlement.");
    expect(labels.some((t) => t.includes("Campaign"))).toBe(false);
    expect(labels).toContain("+40");
    expect(labels).toContain("90");
    expect(labels).toContain("• Cap");
    expect(labels.some((t) => t.includes("Band"))).toBe(false);
    expect(labels).toContain(
      "1 item auto-sold because the bag was full (6 gold)",
    );
    expect(labels).toContain("82");
    expect(labels).toContain("/ 100 HP");
    expect(labels).toContain("Back to Town");
    expect(labels).toContain("Enter or Space");
    expect((panel.root as unknown as FakeGameObject).last("setData")).toEqual([
      "testid",
      "defense-night-summary",
    ]);
    expect(
      (panel.returnBtn.container as unknown as FakeGameObject).last("setData"),
    ).toEqual(["testid", "defense-return-to-town"]);
    const cap = scene.made("text").find((t) => t.args[2] === "• Cap");
    expect((cap as FakeGameObject | undefined)?.args[3]).toMatchObject({
      color: "#0000ff",
    });
  });

  it("renders a lost summary with no loot and returns on Enter", () => {
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: EventListener) => {
        listeners.set(type, fn);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
      devicePixelRatio: 1,
    });
    const scene = fakeScene();
    const onReturn = vi.fn();
    const panel = new NightLootSummaryPanel(
      asScene(scene),
      summaryLostEmpty(),
      onReturn,
    );
    const labels = textsOf(scene);
    expect(labels).toContain("Night 2 lost");
    expect(labels).toContain("No loot this night.");
    expect(labels).toContain("0");
    expect(labels).toContain("/ 100 HP");
    expect(labels.some((t) => t.includes("auto-sold"))).toBe(false);

    const keydown = listeners.get("keydown");
    expect(keydown).toBeTypeOf("function");
    const event = {
      code: "Enter",
      key: "Enter",
      repeat: false,
      preventDefault: vi.fn(),
    };
    keydown?.(event as unknown as Event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onReturn).toHaveBeenCalledTimes(1);

    // Destroyed panel ignores further keys and is idempotent.
    keydown?.(event as unknown as Event);
    expect(onReturn).toHaveBeenCalledTimes(1);
    panel.destroy();
    expect(listeners.has("keydown")).toBe(false);
  });

  it("ignores Space key repeat and tears down on shutdown", () => {
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: EventListener) => {
        listeners.set(type, fn);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
      devicePixelRatio: 1,
    });
    const scene = fakeScene();
    const onReturn = vi.fn();
    const panel = new NightLootSummaryPanel(
      asScene(scene),
      summaryLostEmpty(),
      onReturn,
    );
    const keydown = listeners.get("keydown");
    keydown?.({
      code: "Space",
      key: " ",
      repeat: true,
      preventDefault: vi.fn(),
    } as unknown as Event);
    expect(onReturn).not.toHaveBeenCalled();
    scene.events.emit("shutdown");
    expect((panel.root as unknown as FakeGameObject).destroyed).toBe(true);
    expect(listeners.has("keydown")).toBe(false);
  });
});

describe("NightLootSummaryPanel drops and tips", () => {
  it("shows a verdict per kept drop and Equip swaps even with a full bag", () => {
    const worn = owned(1, "cap");
    const drop = owned(2, "cap", { affixes: [{ id: "vital", value: 4 }] });
    let save = panelSave(3, 90, [worn, drop], { helm: 1 });
    const equip = vi.fn((uid: number) => {
      save = equipNightDrop(catalog, save, uid);
      return save;
    });
    const scene = fakeScene();
    const panel = new NightLootSummaryPanel(
      asScene(scene),
      summaryWon(),
      vi.fn(),
      {
        drops: { catalog, uids: [2], getSave: () => save, equip },
      },
    );
    const labels = textsOf(scene);
    expect(labels).toContain("BETTER");
    expect(labels).toContain("Equip");
    expect(labels.some((t) => t.includes("tap i to compare"))).toBe(true);
    const [target] = panel.dropTargets();
    expect(target?.uid).toBe(2);
    // Tap Equip: the zone under the button.
    const zones = scene
      .made("rectangle")
      .filter(
        (z) => z.args[0] === target?.equip.x && z.args[1] === target?.equip.y,
      );
    expect(zones.length).toBeGreaterThan(0);
    (zones[0] as unknown as { emit(e: string): void }).emit("pointerup");
    expect(equip).toHaveBeenCalledWith(2);
    expect(save.gear.equipped.helm).toBe(2);
    expect(textsOf(scene)).toContain("Worn");
  });

  it("opens the compare tooltip with coloured stat rows", () => {
    const worn = owned(1, "cap");
    const drop = owned(2, "cap", { affixes: [{ id: "vital", value: 4 }] });
    const save = panelSave(3, 90, [worn, drop], { helm: 1 });
    const scene = fakeScene();
    const panel = new NightLootSummaryPanel(
      asScene(scene),
      summaryWon(),
      vi.fn(),
      {
        drops: { catalog, uids: [2], getSave: () => save, equip: () => save },
      },
    );
    panel.openCompare(2);
    const labels = textsOf(scene);
    expect(labels).toContain("NEW DROP");
    expect(labels).toContain("Keep current");
    expect(labels.some((t) => t.startsWith("Better."))).toBe(true);
  });

  it("shows Tips on a lost night", () => {
    const scene = fakeScene();
    new NightLootSummaryPanel(asScene(scene), summaryLostEmpty(), vi.fn(), {
      tips: [
        {
          icon: "shield",
          title: "Raise the wall",
          body: "Beacon · next level +20 wall HP · 50g",
        },
      ],
    });
    const labels = textsOf(scene);
    expect(labels).toContain("TIPS");
    expect(labels).toContain("Raise the wall");
  });
});

describe("NightLootSummaryPanel compare tooltip", () => {
  function setup(equipped = false) {
    const worn = owned(1, "cap");
    const drop = owned(2, "cap", { affixes: [{ id: "vital", value: 4 }] });
    let save = panelSave(3, 90, [worn, drop], { helm: equipped ? 2 : 1 });
    const scene = fakeScene();
    const panel = new NightLootSummaryPanel(
      asScene(scene),
      summaryWon(),
      vi.fn(),
      {
        drops: {
          catalog,
          uids: [2],
          getSave: () => save,
          equip: (uid) => {
            save = equipNightDrop(catalog, save, uid);
            return save;
          },
        },
      },
    );
    const zoneAt = (p: { x: number; y: number } | undefined) =>
      scene
        .made("rectangle")
        .find((z) => z.args[0] === p?.x && z.args[1] === p?.y) as unknown as {
        emit(e: string): void;
      };
    return { scene, panel, zoneAt, save: () => save };
  }

  it("hover previews, pointer-out closes, tap pins and taps toggle it off", () => {
    const { scene, panel, zoneAt } = setup();
    const [t] = panel.dropTargets();
    const info = zoneAt(t?.info);
    info.emit("pointerover");
    expect(textsOf(scene)).toContain("NEW DROP");
    expect(textsOf(scene)).not.toContain("Keep current");
    info.emit("pointerout");
    info.emit("pointerup");
    expect(textsOf(scene)).toContain("Keep current");
    info.emit("pointerout");
    info.emit("pointerup");
    panel.destroy();
    panel.destroy();
  });

  it("an equipped drop shows a Close-only tooltip", () => {
    const { scene, panel } = setup(true);
    panel.openCompare(2);
    expect(textsOf(scene)).toContain("WORN NOW");
    expect(textsOf(scene)).toContain("Close");
    panel.openCompare(99);
  });
});

describe("layoutNightLootSummary", () => {
  it("stacks the sections top to bottom inside the card", () => {
    const L = layoutNightLootSummary(summaryWon(), { rows: 5 });
    const ys = [
      L.titleY,
      L.flavorY,
      L.dividerY,
      L.stats.y,
      L.spoilsY,
      L.rows.y,
      L.soldY ?? 0,
      L.button.y,
      L.hintY,
    ];
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(L.cardTop + L.cardH).toBeLessThanOrEqual(1200);
    expect(L.cardTop + L.cardH).toBeGreaterThan(L.hintY);
  });

  it("uses the empty-loot box and Tips on a lost night", () => {
    const L = layoutNightLootSummary(summaryLostEmpty(), { rows: 0, tips: 2 });
    expect(L.emptyY).not.toBeNull();
    expect(L.soldY).toBeNull();
    expect(L.tips?.y).toBeGreaterThan(L.emptyY ?? 0);
    expect(L.button.y).toBeGreaterThan((L.tips?.y ?? 0) + 2 * 56);
  });
});
