import type { PluginListenerHandle } from "@capacitor/core";
import type { ApkInstaller, UpdateStatus } from "./checkForUpdate";
import {
  checkForUpdate,
  currentAppVersion,
  fetchGithubLatestRelease,
} from "./checkForUpdate";

/**
 * Native-only entry used by the town "Check for update" button.
 * Dynamically import this module so Capacitor stays out of the web bundle.
 */
export async function runCheckForUpdate(
  onStatus: (status: UpdateStatus) => void,
): Promise<UpdateStatus> {
  const { ApkInstaller } = await import("./apkInstallerPlugin");
  let progressHandle: PluginListenerHandle | undefined;
  const installer: ApkInstaller = {
    canInstallPackages: () => ApkInstaller.canInstallPackages(),
    openInstallPermissionSettings: () =>
      ApkInstaller.openInstallPermissionSettings(),
    downloadAndInstall: async (options, onProgress) => {
      if (onProgress) {
        progressHandle = await ApkInstaller.addListener("progress", onProgress);
      }
      try {
        await ApkInstaller.downloadAndInstall(options);
      } finally {
        await progressHandle?.remove();
        progressHandle = undefined;
      }
    },
  };

  const version = currentAppVersion();
  return checkForUpdate({
    currentVersion: version,
    fetchLatest: () => fetchGithubLatestRelease(fetch, version),
    installer,
    onStatus,
  });
}
