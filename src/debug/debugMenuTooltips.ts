/** Debug menu ⓘ tooltip copy (DefenseUIbot `debug-menu-tooltips.md`, v2). */
export type DebugTooltip = {
  intro: string;
  options?: Array<{ name: string; text: string }>;
  footnote: string;
};

export const DEBUG_TOOLTIPS: Record<string, DebugTooltip> = {
  filter: {
    intro: "How pixel art is smoothed when scaled up.",
    options: [
      { name: "Nearest", text: "sharp, blocky pixels (default)." },
      { name: "Linear", text: "smooth everything; softer, blurrier." },
      { name: "Hybrid", text: "sharp art, smooth spell effects." },
    ],
    footnote: "No performance cost. Restarts the night.",
  },
  cam: {
    intro:
      "Snaps the camera to whole pixels as it follows you. On stops ground tiles shimmering; off scrolls more smoothly but can shimmer.",
    footnote: "No performance cost. Applies instantly.",
  },
  renderer: {
    intro:
      "Snaps every sprite to whole pixels. On keeps pixel art crisp while moving; off moves more smoothly but art can wobble or blur.",
    footnote: "No performance cost. Applies instantly.",
  },
  autoround: {
    intro:
      "Rounds the game canvas size to whole pixels when it fits the window. On avoids a slightly blurry canvas at odd window sizes.",
    footnote: "No performance cost. Applies instantly.",
  },
  world: {
    intro:
      "Size of the world art and its collision boxes (1×, 2×, 3×; default 2×). Bigger shows chunkier art but less of the map.",
    footnote: "Restarts the night. Lasts this session only.",
  },
  fullscreen: {
    intro:
      "Switches the browser to fullscreen. Not available on iOS, where it shows N/A.",
    footnote: "No performance cost.",
  },
};
