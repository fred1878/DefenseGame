import { describe, expect, it } from "vitest";
import { createDefenseTickHarness } from "../../test/defenseTickHarness";

/**
 * Enemy-loop cost per simulated frame. Opt-in: `npm run perf` (PERF=1).
 * Record the printed numbers in docs/TESTING.md when a perf-sensitive refactor
 * lands; compare on the same machine only.
 */
const enabled = process.env.PERF === "1";

function msPerFrame(count: number, frames: number): number {
  const harness = createDefenseTickHarness(count, 3);
  // Warm up so enemies have spread out, picked targets and JIT has settled.
  for (let i = 0; i < 120; i++) harness.step(16);
  const samples: number[] = [];
  for (let round = 0; round < 5; round++) {
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) harness.step(16);
    samples.push((performance.now() - t0) / frames);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]!;
}

describe.skipIf(!enabled)("tickDefenseEnemies perf", () => {
  it("reports median ms per frame", () => {
    const rows = [20, 60, 120].map((count) => ({
      enemies: count,
      msPerFrame: Number(msPerFrame(count, 120).toFixed(4)),
    }));
    process.stdout.write(
      `\nenemy-tick perf (ms/frame): ${JSON.stringify(rows)}\n`,
    );
    for (const r of rows) expect(r.msPerFrame).toBeGreaterThan(0);
  }, 300_000);
});
