/**
 * Isometric town art under `public/assets/town/iso/`, built by
 * `scripts/build-town-iso-assets.py` from free packs (SdavGha Pixel Worlds, Kyndrael castle
 * sampler, Antahonist terrain; credits and licence notes in CREDITS.md). Only the sprites
 * the town uses are packed.
 */
export const TOWN_ISO_ROOT = "assets/town/iso";

/** Multi-atlas keys: lit = tappable buildings, dim = scenery, ground = terrain tiles. */
export const TOWN_ISO_ATLAS = {
  lit: "town_iso_lit",
  dim: "town_iso_dim",
  ground: "town_iso_ground",
} as const;

export const TOWN_ISO_ATLAS_FILES = [
  { key: TOWN_ISO_ATLAS.lit, json: "town-iso-lit.json" },
  { key: TOWN_ISO_ATLAS.dim, json: "town-iso-dim.json" },
  { key: TOWN_ISO_ATLAS.ground, json: "town-iso-ground.json" },
] as const;

export const TOWN_ISO_TEXTURE = {
  fog: ["town_iso_fog_1", "town_iso_fog_2", "town_iso_fog_3"],
  vignette: "town_iso_vignette",
  light: "town_iso_light",
  smoke: "town_iso_smoke",
  topBar: "town_hud_topbar",
  bottomBar: "town_hud_bottombar",
} as const;

export const TOWN_ISO_IMAGE_ASSETS = [
  { key: TOWN_ISO_TEXTURE.fog[0], path: `${TOWN_ISO_ROOT}/town-iso-fog-1.png` },
  { key: TOWN_ISO_TEXTURE.fog[1], path: `${TOWN_ISO_ROOT}/town-iso-fog-2.png` },
  { key: TOWN_ISO_TEXTURE.fog[2], path: `${TOWN_ISO_ROOT}/town-iso-fog-3.png` },
  {
    key: TOWN_ISO_TEXTURE.vignette,
    path: `${TOWN_ISO_ROOT}/town-iso-vignette.png`,
  },
  { key: TOWN_ISO_TEXTURE.light, path: `${TOWN_ISO_ROOT}/town-iso-light.png` },
  { key: TOWN_ISO_TEXTURE.smoke, path: `${TOWN_ISO_ROOT}/town-iso-smoke.png` },
  {
    key: TOWN_ISO_TEXTURE.topBar,
    path: "assets/ui/gothic/panels/town-topbar-540.png",
  },
  {
    key: TOWN_ISO_TEXTURE.bottomBar,
    path: "assets/ui/gothic/panels/town-bottombar-540.png",
  },
] as const;

/** Textures sampled LINEAR: the town is drawn at 0.6x, so NEAREST would shimmer. */
export const TOWN_ISO_LINEAR_TEXTURE_KEYS = [
  TOWN_ISO_ATLAS.lit,
  TOWN_ISO_ATLAS.dim,
  ...TOWN_ISO_TEXTURE.fog,
  TOWN_ISO_TEXTURE.vignette,
  TOWN_ISO_TEXTURE.light,
  TOWN_ISO_TEXTURE.smoke,
] as const;
