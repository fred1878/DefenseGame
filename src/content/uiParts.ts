/**
 * Pixel-art UI pieces cut from free itch.io packs (`public/assets/ui/itch/`, credits in
 * CREDITS.md): `da-*` Dark Ages UI (Hypnobius), `gp-*` Gothic Pixel UI (AbyssOwl,
 * credit required), `ed-*` Edinnu UI (rowdy41). Only the cut pieces used ship.
 */
export const UI_PART_ROOT = "assets/ui/itch";

export const UI_PART_FILES = [
  "da-frame-dark",
  "da-frame-ornate",
  "da-btn",
  "da-btn-dark",
  "da-btn-green",
  "da-btn-red",
  "da-plate",
  "da-plate-crest",
  "da-plate-gold",
  "da-plate-crest-top",
  "da-plate-grey",
  "da-slot",
  "da-slot-gold",
  "da-bar",
  "da-bar-crest",
  "da-fill-red-hi",
  "da-fill-gold-hi",
  "da-fill-purple-hi",
  "da-gem-gold",
  "da-gem-grey",
  "gp-oval",
  "gp-toggle-on",
  "gp-toggle-off",
  "ed-heart",
  "ed-moon",
] as const;

export type UiPartName = (typeof UI_PART_FILES)[number];

/** Texture key for a UI part. */
export function uiPartKey(name: UiPartName): string {
  return `uipart_${name}`;
}

export const UI_PART_ASSETS = UI_PART_FILES.map((name) => ({
  key: uiPartKey(name),
  file: `${name}.png`,
}));

/**
 * Nine-slice frames: source slice insets (px) and the display scale. `extendTop` is the
 * crest height (logical px) drawn above the box, like the mockup's crested buttons.
 */
export type UiFrameSpec = {
  part: UiPartName;
  left: number;
  right: number;
  top: number;
  bottom: number;
  scale: number;
  extendTop?: number;
};

export const UI_FRAMES = {
  ornate: {
    part: "da-frame-ornate",
    left: 26,
    right: 26,
    top: 26,
    bottom: 26,
    scale: 0.5,
  },
  dark: {
    part: "da-frame-dark",
    left: 18,
    right: 18,
    top: 18,
    bottom: 18,
    scale: 0.5,
  },
  btn: { part: "da-btn", left: 9, right: 9, top: 5, bottom: 5, scale: 2 },
  btnDark: {
    part: "da-btn-dark",
    left: 9,
    right: 9,
    top: 13,
    bottom: 5,
    scale: 2,
    extendTop: 10,
  },
  btnGreen: {
    part: "da-btn-green",
    left: 9,
    right: 9,
    top: 13,
    bottom: 5,
    scale: 2,
    extendTop: 10,
  },
  btnRed: {
    part: "da-btn-red",
    left: 9,
    right: 9,
    top: 13,
    bottom: 5,
    scale: 2,
    extendTop: 10,
  },
  plate: { part: "da-plate", left: 4, right: 4, top: 4, bottom: 4, scale: 1 },
  plateCrest: {
    part: "da-plate-crest",
    left: 6,
    right: 6,
    top: 11,
    bottom: 4,
    scale: 1,
    extendTop: 6,
  },
  /** Town building name plate (crest drawn separately above it). */
  townPlate: {
    part: "da-plate-gold",
    left: 6,
    right: 6,
    top: 10,
    bottom: 4,
    scale: 2,
  },
  townPlateLocked: {
    part: "da-plate-grey",
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    scale: 2,
  },
  slot: { part: "da-slot", left: 5, right: 5, top: 5, bottom: 5, scale: 1.5 },
  slotGold: {
    part: "da-slot-gold",
    left: 7,
    right: 7,
    top: 11,
    bottom: 7,
    scale: 1.5,
    extendTop: 6,
  },
  bar: { part: "da-bar", left: 9, right: 9, top: 2, bottom: 2, scale: 2 },
  barCrest: {
    part: "da-bar-crest",
    left: 7,
    right: 7,
    top: 9,
    bottom: 3,
    scale: 1,
    extendTop: 6,
  },
} as const satisfies Record<string, UiFrameSpec>;

export type UiFrameName = keyof typeof UI_FRAMES;
