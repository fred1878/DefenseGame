// Economy / progression simulator launcher (see docs/ECONOMY_SIM.md).
// Loads src/sim/economy/cli.ts through Vite's module runner so the sim runs
// the real TypeScript game code and JSON data with no separate build step.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { module } = await runnerImport(
  path.join(root, "src/sim/economy/cli.ts"),
  { root, configFile: false, logLevel: "error" },
);
process.exitCode = module.main(process.argv.slice(2));
