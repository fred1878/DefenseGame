import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Install @capacitor/core + cli when ready for device builds.
 * Web bundle path matches Vite output.
 */
const config: CapacitorConfig = {
  appId: "com.defensegame.app",
  appName: "DefenseGame",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;