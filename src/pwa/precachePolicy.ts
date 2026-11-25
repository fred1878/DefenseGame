/** Theme color shared by the splash page, manifest, and browser chrome. */
export const PWA_THEME_COLOR = "#0f1014";

/** Splash / maskable-icon background; matches the in-game page background. */
export const PWA_BACKGROUND_COLOR = "#0f1014";

/**
 * Built-file globs for the service-worker precache.
 * Covers hashed JS chunks (including the custom Phaser vendor chunk and
 * lazy-loaded scene chunks), CSS, HTML, icons, JSON data, audio, and fonts.
 */
export const PWA_PRECACHE_GLOB_PATTERNS = [
  "**/*.{js,css,html,ico,png,svg,webmanifest,json,mp3,woff,woff2,ttf}",
];

/**
 * `version.json` is written after the Vite build and must stay network-only
 * so a new deploy is detected instead of being served from a stale cache.
 */
export const PWA_PRECACHE_GLOB_IGNORES = ["**/version.json"];

/** True when a request path is the post-build version stamp. */
export function isVersionJsonPath(pathname: string): boolean {
  return pathname === "version.json" || pathname.endsWith("/version.json");
}
