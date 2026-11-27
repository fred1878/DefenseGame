import type Phaser from "phaser";
import { playCoinSpendSfx } from "../../audio/coinEconomySfx";
import { playUiSfx, type UiSfx } from "../../audio/uiSfx";
import type { GearPanelCommand } from "./gearPanelLogic";

/** Sound for a gear-panel command: the existing coin clip for spending, CC0 menu clips otherwise. */
export type PanelSfx = UiSfx | "coinSpend";

/**
 * Which sound a Blacksmith / Trader / Inventory command makes. `changed` is whether the
 * save changed; a refused buy, sell or upgrade (not enough gold, bag full) gives the error thud.
 */
export function gearCommandSfx(
  cmd: GearPanelCommand["type"],
  changed: boolean,
): PanelSfx | null {
  switch (cmd) {
    case "buy":
    case "buyEquip":
    case "reroll":
    case "fillRequest":
      return changed ? "coinSpend" : "error";
    case "sell":
      return changed ? "sell" : "error";
    case "upgradeShop":
      return changed ? "upgrade" : "error";
    case "equip":
    case "unequip":
      return changed ? "equip" : null;
    case "tab":
    case "view":
    case "filter":
      return "tab";
    default:
      return "click";
  }
}

export function playPanelSfx(scene: Phaser.Scene, sfx: PanelSfx | null): void {
  if (sfx === null) return;
  if (sfx === "coinSpend") playCoinSpendSfx(scene);
  else playUiSfx(scene, sfx);
}
