/** Strip a leading `v` and any pre-release / build suffix. */
export function normalizeVersion(version: string): number[] {
  const trimmed = version.trim().replace(/^v/i, "");
  const core = trimmed.split(/[-+]/, 1)[0] ?? "";
  if (core.length === 0) return [0];
  return core.split(".").map((part) => {
    const value = Number.parseInt(part, 10);
    return Number.isFinite(value) ? value : 0;
  });
}

/** Compare two version strings (`v1.2.3` or `1.2.3`). Returns -1, 0, or 1. */
export function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a);
  const right = normalizeVersion(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** True when `latest` is strictly newer than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

export type ReleaseApkAsset = {
  name: string;
  url: string;
  size: number;
  contentType: string;
};

export type ParsedGithubRelease = {
  tagName: string;
  name: string | null;
  prerelease: boolean;
  htmlUrl: string;
  apk: ReleaseApkAsset | null;
};

type GithubAsset = {
  name?: unknown;
  browser_download_url?: unknown;
  content_type?: unknown;
  size?: unknown;
};

type GithubRelease = {
  tag_name?: unknown;
  name?: unknown;
  prerelease?: unknown;
  html_url?: unknown;
  assets?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isGithubAsset(value: unknown): value is GithubAsset {
  return typeof value === "object" && value !== null;
}

/** Prefer a `defensegame-*.apk` asset, otherwise the first `.apk`. */
export function findApkAsset(
  assets: readonly unknown[],
): ReleaseApkAsset | null {
  const apks: ReleaseApkAsset[] = [];
  for (const raw of assets) {
    if (!isGithubAsset(raw)) continue;
    const name = asString(raw.name);
    const url = asString(raw.browser_download_url);
    if (!name || !url || !name.toLowerCase().endsWith(".apk")) continue;
    const size =
      typeof raw.size === "number" && Number.isFinite(raw.size) ? raw.size : 0;
    const contentType =
      asString(raw.content_type) ?? "application/vnd.android.package-archive";
    apks.push({ name, url, size, contentType });
  }
  if (apks.length === 0) return null;
  const named = apks.find((asset) => /defensegame/i.test(asset.name));
  return named ?? apks[0] ?? null;
}

/**
 * Parse a GitHub Releases API payload (`/releases/latest` or one release).
 * Returns null when the payload is not a release with a tag name.
 */
export function parseGithubRelease(
  payload: unknown,
): ParsedGithubRelease | null {
  if (typeof payload !== "object" || payload === null) return null;
  const release = payload as GithubRelease;
  const tagName = asString(release.tag_name);
  if (!tagName) return null;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const name = asString(release.name);
  return {
    tagName,
    name,
    prerelease: release.prerelease === true,
    htmlUrl: asString(release.html_url) ?? "",
    apk: findApkAsset(assets),
  };
}

export const GITHUB_RELEASES_LATEST_URL =
  "https://api.github.com/repos/fred1878/DefenseGame/releases/latest";
