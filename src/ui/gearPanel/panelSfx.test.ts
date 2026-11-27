import { describe, expect, it } from "vitest";
import { gearCommandSfx } from "./panelSfx";

describe("gearCommandSfx", () => {
  it("keeps the existing coin clip for buying and uses the new coins for selling", () => {
    expect(gearCommandSfx("buy", true)).toBe("coinSpend");
    expect(gearCommandSfx("sell", true)).toBe("sell");
  });

  it("thuds when a buy, sell or upgrade is refused", () => {
    expect(gearCommandSfx("buy", false)).toBe("error");
    expect(gearCommandSfx("sell", false)).toBe("error");
    expect(gearCommandSfx("upgradeShop", false)).toBe("error");
    expect(gearCommandSfx("buyEquip", false)).toBe("error");
  });

  it("maps equip, upgrade, tabs and plain taps", () => {
    expect(gearCommandSfx("equip", true)).toBe("equip");
    expect(gearCommandSfx("buyEquip", true)).toBe("coinSpend");
    expect(gearCommandSfx("equip", false)).toBeNull();
    expect(gearCommandSfx("upgradeShop", true)).toBe("upgrade");
    expect(gearCommandSfx("tab", false)).toBe("tab");
    expect(gearCommandSfx("filter", false)).toBe("tab");
    expect(gearCommandSfx("select", false)).toBe("click");
    expect(gearCommandSfx("page", false)).toBe("click");
  });
});
