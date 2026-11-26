import { describe, expect, it, vi } from "vitest";
import iconSvgs from "../../../scripts/data/ui-icons.json";
import { asScene, fakeScene } from "../../test/fakeScene";
import {
  iconForConsumable,
  iconForItemType,
  iconForSlot,
  iconSheetFor,
  queueUiIcons,
  UI_ICON_NAMES,
  uiIconFrame,
} from "./uiIcons";

describe("uiIcons", () => {
  it("lists frames in the same order as the rasterised strip", () => {
    expect([...UI_ICON_NAMES]).toEqual(Object.keys(iconSvgs));
  });

  it("maps item types, slots and consumables to icons", () => {
    expect(iconForItemType("meleeWeapon")).toBe("sword");
    expect(iconForItemType("trinket")).toBe("gem");
    expect(iconForSlot("ring2")).toBe("ring");
    expect(iconForSlot("trinket1")).toBe("gem");
    expect(iconForSlot("hands")).toBe("gloves");
    expect(iconForConsumable({ kind: "heal" })).toBe("potion");
    expect(iconForConsumable({ kind: "bomb" })).toBe("bomb");
  });

  it("picks the strip that never downscales more than 2×", () => {
    expect(iconSheetFor(18).size).toBe(24);
    expect(iconSheetFor(24).size).toBe(24);
    expect(iconSheetFor(40).size).toBe(48);
  });

  it("queues both strips", () => {
    const loader = { image: vi.fn() };
    queueUiIcons(loader as never);
    expect(loader.image).toHaveBeenCalledWith(
      "ui_icons_24",
      "assets/ui/icons/ui-icons-24.png",
    );
    expect(loader.image).toHaveBeenCalledTimes(2);
  });

  it("adds frames on first use and returns null before load", () => {
    expect(uiIconFrame(asScene(fakeScene()), "sword", 20)).toBeNull();
    const frames = new Set<string>();
    const tex = {
      has: (n: string) => frames.has(n),
      add: vi.fn((n: string) => frames.add(n)),
      setFilter: vi.fn(),
    };
    const scene = {
      textures: { exists: () => true, get: () => tex },
    } as never;
    expect(uiIconFrame(scene, "lock", 40)).toEqual({
      key: "ui_icons_48",
      frame: "lock",
    });
    expect(tex.add).toHaveBeenCalledTimes(UI_ICON_NAMES.length);
    expect(tex.add).toHaveBeenCalledWith("bow", 0, 48, 0, 48, 48);
    expect(tex.setFilter).toHaveBeenCalledWith(0);
    uiIconFrame(scene, "bow", 40);
    expect(tex.add).toHaveBeenCalledTimes(UI_ICON_NAMES.length);
  });
});
