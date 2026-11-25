import { describe, expect, it } from "vitest";
import {
  isVersionJsonPath,
  PWA_BACKGROUND_COLOR,
  PWA_PRECACHE_GLOB_IGNORES,
  PWA_PRECACHE_GLOB_PATTERNS,
  PWA_THEME_COLOR,
} from "./precachePolicy";

describe("PWA precache policy", () => {
  it("uses the game background as theme and splash colour", () => {
    expect(PWA_THEME_COLOR).toBe("#0f1014");
    expect(PWA_BACKGROUND_COLOR).toBe("#0f1014");
  });

  it("precache globs include JS, data, images and audio", () => {
    const joined = PWA_PRECACHE_GLOB_PATTERNS.join(" ");
    for (const ext of ["js", "json", "png", "mp3", "html", "webmanifest"]) {
      expect(joined).toContain(ext);
    }
  });

  it("excludes version.json so deploys are not cached forever", () => {
    expect(PWA_PRECACHE_GLOB_IGNORES).toContain("**/version.json");
  });
});

describe("isVersionJsonPath", () => {
  it("matches the stamp at the site root and under a Pages base path", () => {
    expect(isVersionJsonPath("/version.json")).toBe(true);
    expect(isVersionJsonPath("/DefenseGame/version.json")).toBe(true);
    expect(isVersionJsonPath("version.json")).toBe(true);
  });

  it("does not match other JSON data files", () => {
    expect(isVersionJsonPath("/DefenseGame/data/enemies.json")).toBe(false);
    expect(isVersionJsonPath("/assets/version.js")).toBe(false);
  });
});
