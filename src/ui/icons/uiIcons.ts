import Phaser from "phaser";
import type { ConsumableDef } from "../../gear/consumableTypes";
import type { EquipSlot, ItemType } from "../../gear/gearTypes";

/**
 * Panel line icons, frame order of `public/assets/ui/icons/ui-icons-{24,48}.png`
 * (built from `scripts/data/ui-icons.json` by `scripts/build-ui-icons.mjs`).
 */
export const UI_ICON_NAMES = [
  "sword",
  "bow",
  "helm",
  "chest",
  "gloves",
  "legs",
  "boots",
  "ring",
  "gem",
  "potion",
  "bomb",
  "hammer",
  "coins",
  "shield",
  "heart",
  "flame",
  "snowflake",
  "zap",
  "target",
  "wind",
  "star",
  "sparkles",
  "lock",
  "close",
  "sort",
  "arrowUp",
  "droplet",
  "user",
  "refresh",
] as const;
export type UiIconName = (typeof UI_ICON_NAMES)[number];

export const UI_ICON_ROOT = "assets/ui/icons";
export const UI_ICON_SHEETS = [
  { key: "ui_icons_24", file: "ui-icons-24.png", size: 24 },
  { key: "ui_icons_48", file: "ui-icons-48.png", size: 48 },
] as const;

const TYPE_ICON: Record<ItemType, UiIconName> = {
  meleeWeapon: "sword",
  rangedWeapon: "bow",
  helm: "helm",
  chest: "chest",
  hands: "gloves",
  legs: "legs",
  boots: "boots",
  ring: "ring",
  trinket: "gem",
};

export function iconForItemType(type: ItemType): UiIconName {
  return TYPE_ICON[type];
}

export function iconForSlot(slot: EquipSlot): UiIconName {
  if (slot === "ring1" || slot === "ring2") return "ring";
  if (slot === "trinket1" || slot === "trinket2") return "gem";
  return TYPE_ICON[slot];
}

export function iconForConsumable(
  def: Pick<ConsumableDef, "kind">,
): UiIconName {
  return def.kind === "heal" ? "potion" : "bomb";
}

/** Sheet for an icon drawn at `px` (never downscale more than 2×). */
export function iconSheetFor(px: number): (typeof UI_ICON_SHEETS)[number] {
  return px <= 24 ? UI_ICON_SHEETS[0] : UI_ICON_SHEETS[1];
}

/** Queue both icon strips (town fluff). */
export function queueUiIcons(loader: Phaser.Loader.LoaderPlugin): void {
  for (const s of UI_ICON_SHEETS) {
    loader.image(s.key, `${UI_ICON_ROOT}/${s.file}`);
  }
}

/**
 * Texture key + frame name for `icon` at `px`, adding the strip's frames on
 * first use (smooth filtering; the game defaults to NEAREST). Null until loaded.
 */
export function uiIconFrame(
  scene: Phaser.Scene,
  icon: UiIconName,
  px: number,
): { key: string; frame: string } | null {
  const sheet = iconSheetFor(px);
  if (!scene.textures.exists(sheet.key)) return null;
  const tex = scene.textures.get(sheet.key);
  if (!tex.has(icon)) {
    UI_ICON_NAMES.forEach((name, i) => {
      if (!tex.has(name)) {
        tex.add(name, 0, i * sheet.size, 0, sheet.size, sheet.size);
      }
    });
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return { key: sheet.key, frame: icon };
}
