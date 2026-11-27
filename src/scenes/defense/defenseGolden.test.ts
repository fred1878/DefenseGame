import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDefenseTickHarness,
  harnessDataHash,
} from "../../test/defenseTickHarness";

/**
 * Golden behaviour snapshot for the headless enemy loop (refactor safety net).
 *
 * The digests depend on shipped `public/data` tuning, so they are keyed by a
 * hash of that data: after a balance edit the comparison is skipped until the
 * snapshot is refreshed with `UPDATE_GOLDEN=1 npx vitest run defenseGolden`.
 * A refactor that changes the digest while the data hash is unchanged is a
 * behaviour change and must be intentional.
 */
const GOLDEN_FILE = path.join(
  process.cwd(),
  "src/test/fixtures/defenseGolden.json",
);

type Golden = { dataHash: string; digests: Record<string, string> };

const SCENARIOS: Array<{ name: string; enemies: number; frames: number }> = [
  { name: "10x600", enemies: 10, frames: 600 },
  { name: "30x300", enemies: 30, frames: 300 },
  { name: "60x120", enemies: 60, frames: 120 },
];

function runScenario(enemies: number, frames: number): string {
  const h = createDefenseTickHarness(enemies, 7);
  for (let i = 0; i < frames; i++) h.step(16);
  return h.digest();
}

const current = harnessDataHash();
const golden = JSON.parse(readFileSync(GOLDEN_FILE, "utf8")) as Golden;
const update = process.env.UPDATE_GOLDEN === "1";

describe("defense enemy loop golden snapshot", () => {
  it("is deterministic", () => {
    expect(runScenario(10, 120)).toBe(runScenario(10, 120));
  });

  if (update) {
    it("writes a fresh golden snapshot", () => {
      const digests: Record<string, string> = {};
      for (const s of SCENARIOS)
        digests[s.name] = runScenario(s.enemies, s.frames);
      writeFileSync(
        GOLDEN_FILE,
        `${JSON.stringify({ dataHash: current, digests }, null, 2)}\n`,
      );
    });
    return;
  }

  for (const s of SCENARIOS) {
    it.skipIf(golden.dataHash !== current)(
      `matches ${s.name} (skipped when public/data changed; refresh with UPDATE_GOLDEN=1)`,
      () => {
        expect(runScenario(s.enemies, s.frames)).toBe(golden.digests[s.name]);
      },
      // A* replans dominate with 60 enemies; coverage instrumentation makes
      // this several times slower than a plain run.
      60_000,
    );
  }
});
