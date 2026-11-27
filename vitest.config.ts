import { defineConfig } from "vitest/config";
import fs from "node:fs";
import path from "node:path";

const TEST_GLOB = "src/**/*.test.ts";
/**
 * Scene tests boot the real (vendored) Phaser build headless under jsdom +
 * node-canvas. Slower than the stub-based projects, so they live in their own
 * project and never share a worker with them.
 */
const SCENE_TEST_GLOB = "src/**/*.scene.test.ts";
const PHASER_STUB = path.resolve(import.meta.dirname, "src/test/phaserStub.ts");
const PHASER_REAL = path.resolve(
  import.meta.dirname,
  "node_modules/phaser/dist/phaser-defensegame.js",
);

/**
 * Test files that replace modules with `vi.mock` / `vi.doMock`. A mock only
 * applies if the module is not already cached, so these run isolated (one
 * module graph per file); every other file shares workers (`isolate: false`),
 * which skips ~200 ms of worker startup per file. Found by scanning, so a new
 * mocking test is isolated automatically.
 */
function mockingTestFiles(): string[] {
  const root = import.meta.dirname;
  return fs
    .globSync(TEST_GLOB, { cwd: root, exclude: [SCENE_TEST_GLOB] })
    .filter((f) =>
      /\bvi\.(?:mock|doMock)\(/.test(
        fs.readFileSync(path.join(root, f), "utf8"),
      ),
    )
    .sort();
}
const MOCKING_TESTS = mockingTestFiles();

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/test/bootPublicConfig.ts"],
    projects: [
      {
        extends: true,
        resolve: { alias: { phaser: PHASER_STUB } },
        test: {
          name: "shared",
          include: [TEST_GLOB],
          exclude: [...MOCKING_TESTS, SCENE_TEST_GLOB],
          isolate: false,
        },
      },
      {
        extends: true,
        resolve: { alias: { phaser: PHASER_STUB } },
        test: { name: "isolated", include: MOCKING_TESTS },
      },
      {
        extends: true,
        resolve: { alias: { phaser: PHASER_REAL } },
        test: {
          name: "scenes",
          include: [SCENE_TEST_GLOB],
          environment: "jsdom",
          environmentOptions: {
            jsdom: { resources: "usable", pretendToBeVisual: true },
          },
          setupFiles: ["src/test/scene/sceneTestSetup.ts"],
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/vite-env.d.ts",
        "src/bootstrap.ts",
        "src/gameMain.ts",
        "src/scenes/DebugMenuScene.ts",
        "src/scenes/EndlessModeSetupScene.ts",
        "src/scenes/defense/DefenseSceneE2ECombat.ts",
        "src/scenes/defense/DefenseSceneE2EHud.ts",
        "src/scenes/defense/DefenseSceneE2EObstacles.ts",
        "src/appUpdate/apkInstallerPlugin.ts",
        "src/appUpdate/runCheckForUpdate.ts",
      ],
      // Scene files are covered by the real-Phaser `scenes` project; the ones
      // above are E2E-only adapters, Capacitor stubs, or still need scene
      // tests. Floors only ratchet up: add tests, never lower them.
      thresholds: {
        lines: 97,
        functions: 96.5,
        branches: 92,
        statements: 96.5,
      },
    },
  },
});
