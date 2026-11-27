import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      phaser: path.resolve(import.meta.dirname, "src/test/phaserStub.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["src/test/bootPublicConfig.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/vite-env.d.ts",
        "src/bootstrap.ts",
        "src/gameMain.ts",
        "src/scenes/BootScene.ts",
        "src/scenes/DebugMenuScene.ts",
        "src/scenes/DefenseScene.ts",
        "src/scenes/EndlessModeSetupScene.ts",
        "src/scenes/TownScene.ts",
        "src/scenes/WavePlannerSetupScene.ts",
        "src/scenes/defense/DefenseSceneE2ECombat.ts",
        "src/scenes/defense/DefenseSceneE2EHud.ts",
        "src/scenes/defense/DefenseSceneE2EObstacles.ts",
        "src/scenes/defense/DefenseHudController.ts",
        "src/scenes/defense/DefensePlayerCombat.ts",
        "src/scenes/defense/DefenseDebugDraw.ts",
        "src/scenes/defense/DefenseConsumables.ts",
        "src/scenes/defense/DefenseWorldBootstrap.ts",
        "src/scenes/defense/DamageNumberFx.ts",
        "src/scenes/defense/DefenseSpellWorldTick.ts",
        "src/scenes/defense/DefenseSpellResolve.ts",
        "src/scenes/town/TownOverlays.ts",
        "src/scenes/town/TownHeader.ts",
        "src/appUpdate/apkInstallerPlugin.ts",
        "src/appUpdate/runCheckForUpdate.ts",
        "src/world/defenseCamera.ts",
      ],
      // Scene orchestrators and Phaser-heavy HUD glue stay excluded above;
      // `scenes/defense/*` modules and `src/world/**` are in scope. Ratchet
      // floors as more scene tests land (pre-expansion was ~98% / ~96%).
      thresholds: {
        // Floors after scenes/world inclusion (orchestrators still excluded above).
        lines: 95,
        functions: 95,
        branches: 91,
        statements: 94,
      },
    },
  },
});
