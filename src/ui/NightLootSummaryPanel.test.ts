import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleNightLootSummary } from "../gear/nightLootSummary";
import { gearFixture } from "../test/gearFixture";
import { asScene, fakeScene, type FakeGameObject } from "../test/fakeScene";
import { NightLootSummaryPanel } from "./NightLootSummaryPanel";

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
    expect(labels.some((t) => t.includes("Campaign advances"))).toBe(true);
    expect(labels).toContain("+40 gold");
    expect(labels).toContain("90 gold");
    expect(labels).toContain("• Cap");
    expect(labels).toContain("• Band (sold)");
    expect(labels).toContain(
      "1 item auto-sold because the bag was full (6 gold)",
    );
    expect(labels).toContain("82 / 100 HP");
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
    expect(labels).toContain("0 / 100 HP");
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
