import { describe, expect, it } from "vitest";
import {
  compareVersions,
  findApkAsset,
  isNewerVersion,
  normalizeVersion,
  parseGithubRelease,
} from "./releaseVersion";

describe("normalizeVersion", () => {
  it("strips a leading v and splits numeric parts", () => {
    expect(normalizeVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(normalizeVersion("0.1.0")).toEqual([0, 1, 0]);
    expect(normalizeVersion("  V2.0 ")).toEqual([2, 0]);
  });

  it("ignores pre-release and build suffixes", () => {
    expect(normalizeVersion("1.2.3-beta.1")).toEqual([1, 2, 3]);
    expect(normalizeVersion("v1.0.0+build.9")).toEqual([1, 0, 0]);
  });

  it("treats empty or non-numeric parts as zero", () => {
    expect(normalizeVersion("")).toEqual([0]);
    expect(normalizeVersion("v")).toEqual([0]);
    expect(normalizeVersion("1.x.2")).toEqual([1, 0, 2]);
  });
});

describe("compareVersions / isNewerVersion", () => {
  it("orders versions numerically, not lexicographically", () => {
    expect(compareVersions("v0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("0.1.10", "0.1.9")).toBe(1);
    expect(compareVersions("0.2.0", "0.10.0")).toBe(-1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0")).toBe(1);
  });

  it("detects a newer release tag", () => {
    expect(isNewerVersion("v0.2.0", "0.1.0")).toBe(true);
    expect(isNewerVersion("0.1.0", "v0.1.0")).toBe(false);
    expect(isNewerVersion("0.1.0", "0.2.0")).toBe(false);
  });
});

describe("findApkAsset", () => {
  it("returns null when no apk is present", () => {
    expect(findApkAsset([])).toBeNull();
    expect(
      findApkAsset([{ name: "notes.txt", browser_download_url: "x" }]),
    ).toBeNull();
  });

  it("prefers a defensegame-*.apk over other apks", () => {
    const picked = findApkAsset([
      {
        name: "other.apk",
        browser_download_url: "https://example.com/other.apk",
        size: 10,
        content_type: "application/vnd.android.package-archive",
      },
      {
        name: "defensegame-0.2.0.apk",
        browser_download_url: "https://example.com/defensegame-0.2.0.apk",
        size: 20,
      },
    ]);
    expect(picked).toEqual({
      name: "defensegame-0.2.0.apk",
      url: "https://example.com/defensegame-0.2.0.apk",
      size: 20,
      contentType: "application/vnd.android.package-archive",
    });
  });

  it("falls back to the first apk when none is named defensegame", () => {
    const picked = findApkAsset([
      {
        name: "app-release.apk",
        browser_download_url: "https://example.com/app-release.apk",
        size: 5,
        content_type: "application/octet-stream",
      },
    ]);
    expect(picked?.name).toBe("app-release.apk");
    expect(picked?.contentType).toBe("application/octet-stream");
  });
});

describe("parseGithubRelease", () => {
  const payload = {
    tag_name: "v0.2.0",
    name: "0.2.0",
    prerelease: false,
    html_url: "https://github.com/fred1878/DefenseGame/releases/tag/v0.2.0",
    assets: [
      {
        name: "defensegame-web-v0.2.0.zip",
        browser_download_url: "https://example.com/web.zip",
        size: 100,
        content_type: "application/zip",
      },
      {
        name: "defensegame-0.2.0.apk",
        browser_download_url: "https://example.com/game.apk",
        size: 200,
        content_type: "application/vnd.android.package-archive",
      },
    ],
  };

  it("extracts the tag, notes url, and apk asset", () => {
    expect(parseGithubRelease(payload)).toEqual({
      tagName: "v0.2.0",
      name: "0.2.0",
      prerelease: false,
      htmlUrl: "https://github.com/fred1878/DefenseGame/releases/tag/v0.2.0",
      apk: {
        name: "defensegame-0.2.0.apk",
        url: "https://example.com/game.apk",
        size: 200,
        contentType: "application/vnd.android.package-archive",
      },
    });
  });

  it("returns null for invalid payloads", () => {
    expect(parseGithubRelease(null)).toBeNull();
    expect(parseGithubRelease("nope")).toBeNull();
    expect(parseGithubRelease({})).toBeNull();
    expect(parseGithubRelease({ tag_name: 1 })).toBeNull();
  });

  it("tolerates a release with no assets", () => {
    const parsed = parseGithubRelease({
      tag_name: "v0.1.0",
      prerelease: true,
    });
    expect(parsed).toEqual({
      tagName: "v0.1.0",
      name: null,
      prerelease: true,
      htmlUrl: "",
      apk: null,
    });
  });
});
