import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type ApkDownloadProgress = {
  received: number;
  total: number;
};

export type ApkInstallerPlugin = {
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: { url: string; fileName: string }): Promise<void>;
  addListener(
    eventName: "progress",
    listener: (event: ApkDownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
};

/**
 * Bridge to the native ApkInstaller Capacitor plugin.
 * Import this module only from a dynamic import so it stays out of the
 * Phaser web bundle.
 */
export const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");
