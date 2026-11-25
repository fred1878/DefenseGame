import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fred1878.defensegame",
  appName: "DefenseGame",
  webDir: "dist",
  backgroundColor: "#0f1014",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0f1014",
  },
};

export default config;
