import { describe, expect, it, vi } from "vitest";
import {
  checkForUpdate,
  fetchGithubLatestRelease,
  formatUpdateStatus,
  type ApkInstaller,
  type UpdateStatus,
} from "./checkForUpdate";
import { GITHUB_RELEASES_LATEST_URL } from "./releaseVersion";

function releasePayload(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: "v0.2.0",
    name: "0.2.0",
    prerelease: false,
    html_url: "https://github.com/fred1878/DefenseGame/releases/tag/v0.2.0",
    assets: [
      {
        name: "defensegame-0.2.0.apk",
        browser_download_url: "https://example.com/defensegame-0.2.0.apk",
        size: 1000,
        content_type: "application/vnd.android.package-archive",
      },
    ],
    ...overrides,
  };
}

function installer(overrides: Partial<ApkInstaller> = {}): ApkInstaller {
  return {
    canInstallPackages: vi.fn().mockResolvedValue({ allowed: true }),
    openInstallPermissionSettings: vi.fn().mockResolvedValue(undefined),
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function run(
  deps: Partial<Parameters<typeof checkForUpdate>[0]> & {
    currentVersion?: string;
  } = {},
): Promise<{ final: UpdateStatus; statuses: UpdateStatus[] }> {
  const statuses: UpdateStatus[] = [];
  const final = await checkForUpdate({
    currentVersion: deps.currentVersion ?? "0.1.0",
    fetchLatest: deps.fetchLatest ?? (async () => releasePayload()),
    installer: deps.installer ?? installer(),
    onStatus: (status) => {
      statuses.push(status);
      deps.onStatus?.(status);
    },
  });
  return { final, statuses };
}

describe("formatUpdateStatus", () => {
  it("describes each status kind", () => {
    expect(formatUpdateStatus({ kind: "checking" })).toBe(
      "Checking for updates…",
    );
    expect(
      formatUpdateStatus({
        kind: "upToDate",
        current: "0.1.0",
        latest: "v0.1.0",
      }),
    ).toBe("Up to date");
    expect(
      formatUpdateStatus({
        kind: "available",
        current: "0.1.0",
        latest: "v0.2.0",
        apk: {
          name: "game.apk",
          url: "https://example.com/game.apk",
          size: 1,
          contentType: "application/vnd.android.package-archive",
        },
      }),
    ).toBe("Update v0.2.0 available");
    expect(
      formatUpdateStatus({
        kind: "downloading",
        current: "0.1.0",
        latest: "v0.2.0",
        received: 250,
        total: 1000,
      }),
    ).toBe("Downloading v0.2.0… 25%");
    expect(
      formatUpdateStatus({
        kind: "downloading",
        current: "0.1.0",
        latest: "v0.2.0",
        received: 10,
        total: 0,
      }),
    ).toBe("Downloading v0.2.0…");
    expect(
      formatUpdateStatus({
        kind: "installing",
        current: "0.1.0",
        latest: "v0.2.0",
      }),
    ).toBe("Installing…");
    expect(
      formatUpdateStatus({
        kind: "needsPermission",
        current: "0.1.0",
        latest: "v0.2.0",
      }),
    ).toBe("Allow installing unknown apps, then try again");
    expect(formatUpdateStatus({ kind: "error", message: "Network down" })).toBe(
      "Network down",
    );
  });
});

describe("checkForUpdate", () => {
  it("reports up to date when the latest tag is not newer", async () => {
    const { final, statuses } = await run({
      currentVersion: "0.2.0",
    });
    expect(final).toEqual({
      kind: "upToDate",
      current: "0.2.0",
      latest: "v0.2.0",
    });
    expect(statuses.map((s) => s.kind)).toEqual(["checking", "upToDate"]);
  });

  it("returns an error when the releases request fails", async () => {
    const { final } = await run({
      fetchLatest: async () => {
        throw new Error("offline");
      },
    });
    expect(final).toEqual({ kind: "error", message: "offline" });
  });

  it("returns an error when the payload is not a release", async () => {
    const { final } = await run({ fetchLatest: async () => ({}) });
    expect(final).toEqual({
      kind: "error",
      message: "Could not read the latest release",
    });
  });

  it("returns an error when a newer release has no APK", async () => {
    const { final } = await run({
      fetchLatest: async () => releasePayload({ assets: [] }),
    });
    expect(final).toEqual({
      kind: "error",
      message: "Release v0.2.0 has no APK yet",
    });
  });

  it("opens install settings when the app may not install packages", async () => {
    const inst = installer({
      canInstallPackages: vi.fn().mockResolvedValue({ allowed: false }),
    });
    const { final } = await run({ installer: inst });
    expect(inst.openInstallPermissionSettings).toHaveBeenCalledOnce();
    expect(inst.downloadAndInstall).not.toHaveBeenCalled();
    expect(final.kind).toBe("needsPermission");
  });

  it("downloads and installs when a newer APK is available", async () => {
    const inst = installer({
      downloadAndInstall: vi.fn(async (_options, onProgress) => {
        onProgress?.({ received: 500, total: 1000 });
      }),
    });
    const { final, statuses } = await run({ installer: inst });
    expect(inst.downloadAndInstall).toHaveBeenCalledWith(
      {
        url: "https://example.com/defensegame-0.2.0.apk",
        fileName: "defensegame-0.2.0.apk",
      },
      expect.any(Function),
    );
    expect(final).toEqual({
      kind: "installing",
      current: "0.1.0",
      latest: "v0.2.0",
    });
    const kinds = statuses.map((s) => s.kind);
    expect(kinds).toContain("available");
    expect(kinds).toContain("downloading");
    expect(kinds.at(-1)).toBe("installing");
    expect(
      statuses.some(
        (s) =>
          s.kind === "downloading" && s.received === 500 && s.total === 1000,
      ),
    ).toBe(true);
  });

  it("reports a download failure", async () => {
    const inst = installer({
      downloadAndInstall: vi.fn().mockRejectedValue(new Error("disk full")),
    });
    const { final } = await run({ installer: inst });
    expect(final).toEqual({ kind: "error", message: "disk full" });
  });

  it("reports a permission-check failure", async () => {
    const inst = installer({
      canInstallPackages: vi.fn().mockRejectedValue("denied"),
    });
    const { final } = await run({ installer: inst });
    expect(final).toEqual({ kind: "error", message: "denied" });
  });

  it("reports a failure opening install settings", async () => {
    const inst = installer({
      canInstallPackages: vi.fn().mockResolvedValue({ allowed: false }),
      openInstallPermissionSettings: vi
        .fn()
        .mockRejectedValue(new Error("settings blocked")),
    });
    const { final } = await run({ installer: inst });
    expect(final).toEqual({ kind: "error", message: "settings blocked" });
  });

  it("uses a fallback message for empty errors", async () => {
    const { final } = await run({
      fetchLatest: async () => {
        throw new Error("   ");
      },
    });
    expect(final).toEqual({
      kind: "error",
      message: "Could not reach GitHub Releases",
    });
  });
});

describe("fetchGithubLatestRelease", () => {
  it("requests the latest release with the GitHub API headers", async () => {
    const json = vi.fn().mockResolvedValue({ tag_name: "v0.2.0" });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json,
    });
    await expect(fetchGithubLatestRelease(fetchImpl, "0.1.0")).resolves.toEqual(
      { tag_name: "v0.2.0" },
    );
    expect(fetchImpl).toHaveBeenCalledWith(GITHUB_RELEASES_LATEST_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "DefenseGame/0.1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  });

  it("maps 404 to a clear error and other failures to a status error", async () => {
    const notFound = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchGithubLatestRelease(notFound)).rejects.toThrow(
      "No GitHub releases found yet",
    );
    const failed = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchGithubLatestRelease(failed)).rejects.toThrow(
      "GitHub releases request failed (500)",
    );
  });
});
