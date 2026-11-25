import { writeFileSync } from "node:fs";

const buildId = process.env.VITE_BUILD_ID ?? "local";
const payload = {
  buildId,
  builtAt: new Date().toISOString(),
};

writeFileSync("dist/version.json", `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote dist/version.json (buildId=${buildId})`);
