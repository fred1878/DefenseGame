import { describe, expect, it, vi } from "vitest";
import { gearCommandSfx, playPanelSfx } from "./panelSfx";

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

describe("playPanelSfx", () => {
  function scene(play = vi.fn()) {
    return {
      cache: { audio: { exists: vi.fn(() => true) } },
      sound: { play },
    } as unknown as Phaser.Scene;
  }
  it("plays nothing for null, the coin clip for spends and UI clips otherwise", () => {
    const play = vi.fn();
    playPanelSfx(scene(play), null);
    expect(play).not.toHaveBeenCalled();
    playPanelSfx(scene(play), "coinSpend");
    expect(play).toHaveBeenCalledTimes(1);
    playPanelSfx(scene(play), "sell");
    expect(play).toHaveBeenLastCalledWith("sfx_ui_sell", expect.anything());
  });
});
