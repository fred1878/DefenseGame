import {
  GITHUB_RELEASES_LATEST_URL,
  isNewerVersion,
  parseGithubRelease,
  type ParsedGithubRelease,
  type ReleaseApkAsset,
} from "./releaseVersion";

export type UpdateStatus =
  | { kind: "checking" }
  | { kind: "upToDate"; current: string; latest: string }
  | {
      kind: "available";
      current: string;
      latest: string;
      apk: ReleaseApkAsset;
    }
  | {
      kind: "downloading";
      current: string;
      latest: string;
      received: number;
      total: number;
    }
  | { kind: "installing"; current: string; latest: string }
  | { kind: "needsPermission"; current: string; latest: string }
  | { kind: "error"; message: string };

export type ApkInstaller = {
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(
    options: { url: string; fileName: string },
    onProgress?: (event: { received: number; total: number }) => void,
  ): Promise<void>;
};

export type FetchLatestRelease = () => Promise<unknown>;

export type CheckForUpdateDeps = {
  currentVersion: string;
  fetchLatest: FetchLatestRelease;
  installer: ApkInstaller;
  onStatus?: (status: UpdateStatus) => void;
};

export function formatUpdateStatus(status: UpdateStatus): string {
  switch (status.kind) {
    case "checking":
      return "Checking for updates…";
    case "upToDate":
      return "Up to date";
    case "available":
      return `Update ${status.latest} available`;
    case "downloading": {
      if (status.total > 0) {
        const pct = Math.min(
          100,
          Math.round((status.received / status.total) * 100),
        );
        return `Downloading ${status.latest}… ${pct}%`;
      }
      return `Downloading ${status.latest}…`;
    }
    case "installing":
      return "Installing…";
    case "needsPermission":
      return "Allow installing unknown apps, then try again";
    case "error":
      return status.message;
  }
}

export async function fetchGithubLatestRelease(
  fetchImpl: typeof fetch = fetch,
  currentVersion = "0",
): Promise<unknown> {
  const response = await fetchImpl(GITHUB_RELEASES_LATEST_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `DefenseGame/${currentVersion}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) {
    throw new Error("No GitHub releases found yet");
  }
  if (!response.ok) {
    throw new Error(`GitHub releases request failed (${response.status})`);
  }
  return response.json();
}

function emit(
  onStatus: ((status: UpdateStatus) => void) | undefined,
  status: UpdateStatus,
): UpdateStatus {
  onStatus?.(status);
  return status;
}

/**
 * Compare the installed app version with the latest GitHub Release and,
 * if a newer APK is available, download it and open the system installer.
 */
export async function checkForUpdate(
  deps: CheckForUpdateDeps,
): Promise<UpdateStatus> {
  const { currentVersion, fetchLatest, installer, onStatus } = deps;
  emit(onStatus, { kind: "checking" });

  let payload: unknown;
  try {
    payload = await fetchLatest();
  } catch (err) {
    return emit(onStatus, {
      kind: "error",
      message: errorMessage(err, "Could not reach GitHub Releases"),
    });
  }

  const release = parseGithubRelease(payload);
  if (!release) {
    return emit(onStatus, {
      kind: "error",
      message: "Could not read the latest release",
    });
  }

  if (!isNewerVersion(release.tagName, currentVersion)) {
    return emit(onStatus, {
      kind: "upToDate",
      current: currentVersion,
      latest: release.tagName,
    });
  }

  if (!release.apk) {
    return emit(onStatus, {
      kind: "error",
      message: `Release ${release.tagName} has no APK yet`,
    });
  }

  emit(onStatus, {
    kind: "available",
    current: currentVersion,
    latest: release.tagName,
    apk: release.apk,
  });

  return downloadAndInstallRelease({
    currentVersion,
    release,
    apk: release.apk,
    installer,
    onStatus,
  });
}

async function downloadAndInstallRelease(options: {
  currentVersion: string;
  release: ParsedGithubRelease;
  apk: ReleaseApkAsset;
  installer: ApkInstaller;
  onStatus: ((status: UpdateStatus) => void) | undefined;
}): Promise<UpdateStatus> {
  const { currentVersion, release, apk, installer, onStatus } = options;

  let allowed = false;
  try {
    allowed = (await installer.canInstallPackages()).allowed;
  } catch (err) {
    return emit(onStatus, {
      kind: "error",
      message: errorMessage(err, "Could not check install permission"),
    });
  }

  if (!allowed) {
    try {
      await installer.openInstallPermissionSettings();
    } catch (err) {
      return emit(onStatus, {
        kind: "error",
        message: errorMessage(err, "Could not open install settings"),
      });
    }
    return emit(onStatus, {
      kind: "needsPermission",
      current: currentVersion,
      latest: release.tagName,
    });
  }

  emit(onStatus, {
    kind: "downloading",
    current: currentVersion,
    latest: release.tagName,
    received: 0,
    total: apk.size,
  });

  try {
    await installer.downloadAndInstall(
      { url: apk.url, fileName: apk.name },
      (event) => {
        emit(onStatus, {
          kind: "downloading",
          current: currentVersion,
          latest: release.tagName,
          received: event.received,
          total: event.total > 0 ? event.total : apk.size,
        });
      },
    );
  } catch (err) {
    return emit(onStatus, {
      kind: "error",
      message: errorMessage(err, "Download or install failed"),
    });
  }

  return emit(onStatus, {
    kind: "installing",
    current: currentVersion,
    latest: release.tagName,
  });
}

export function currentAppVersion(): string {
  return import.meta.env.VITE_APP_VERSION ?? "0.1.0";
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  if (typeof err === "string" && err.trim().length > 0) return err;
  return fallback;
}
