import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main, parseCliArgs, runSimulation, USAGE } from "./cli";
import { DEFAULT_POWER_MODEL } from "./power";
import { STRATEGY_IDS } from "./simulate";

describe("econ sim CLI", () => {
  it("parses defaults", () => {
    const o = parseCliArgs([]);
    expect(o).toMatchObject({
      runs: 1000,
      seed: 1,
      winModel: "power",
      winRate: 0.85,
      nights: null,
      sets: [],
      overridesFile: null,
      sellSurplus: true,
      outDir: "sim-output",
      quiet: false,
      help: false,
    });
    expect(o.strategies).toEqual([...STRATEGY_IDS]);
  });

  it("parses every option", () => {
    const o = parseCliArgs([
      "--runs",
      "5",
      "--seed",
      "9",
      "--strategy",
      "gear-first",
      "--win-model",
      "fixed",
      "--win-rate",
      "0.5",
      "--nights",
      "4",
      "--set",
      "loot.sellBackPct=25",
      "--set",
      "waves.1.rewardGold=1",
      "--overrides",
      "o.json",
      "--no-sell",
      "--no-talents",
      "--still-share",
      "0.7",
      "--moving-share",
      "0.2",
      "--crowd-area",
      "9000",
      "--exposure",
      "1.5",
      "--grace",
      "5",
      "--threat",
      "0.3",
      "--steepness",
      "2",
      "--weights",
      "0.5, 0.25,0.25",
      "--easy",
      "3",
      "--hard",
      "0.8",
      "--out",
      "x",
      "--quiet",
      "--help",
    ]);
    expect(o).toMatchObject({
      runs: 5,
      seed: 9,
      strategies: ["gear-first"],
      winModel: "fixed",
      winRate: 0.5,
      nights: 4,
      sets: ["loot.sellBackPct=25", "waves.1.rewardGold=1"],
      overridesFile: "o.json",
      sellSurplus: false,
      talents: false,
      model: {
        castStillShare: 0.7,
        castMovingShare: 0.2,
        crowdAreaWu2: 9000,
        exposure: 1.5,
        graceSec: 5,
        threatScale: 0.3,
        steepness: 2,
        offenceWeight: 0.5,
        defenceWeight: 0.25,
        wallWeight: 0.25,
      },
      flags: { easy: 3, hard: 0.8 },
      outDir: "x",
      quiet: true,
      help: true,
    });
  });

  it("reads model knobs from a fitted model file, flags win", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "econ-model-"));
    const fitted = path.join(dir, "fit.json");
    writeFileSync(
      fitted,
      JSON.stringify({ model: { steepness: 7, exposure: 0.2 } }),
    );
    const o = parseCliArgs(["--model", fitted, "--exposure", "0.9"]);
    expect(o.model.steepness).toBe(7);
    expect(o.model.exposure).toBe(0.9);
    const flat = path.join(dir, "flat.json");
    writeFileSync(flat, JSON.stringify({ threatScale: 0.11 }));
    expect(parseCliArgs(["--model", flat]).model.threatScale).toBe(0.11);
  });

  it("rejects bad options", () => {
    expect(() => parseCliArgs(["--strategy", "x"])).toThrow(
      /Unknown --strategy/,
    );
    expect(() => parseCliArgs(["--win-model", "x"])).toThrow(/power or fixed/);
    expect(() => parseCliArgs(["--win-rate", "2"])).toThrow(/between 0 and 1/);
    expect(() => parseCliArgs(["--runs=-1"])).toThrow(/non-negative/);
    expect(() => parseCliArgs(["--bogus"])).toThrow();
    expect(() => parseCliArgs(["--weights", "1,2"])).toThrow(/three numbers/);
    expect(() => parseCliArgs(["--weights", "1,x,2"])).toThrow(/non-negative/);
    expect(parseCliArgs([]).model.defenceWeight).toBe(
      DEFAULT_POWER_MODEL.defenceWeight,
    );
  });

  it("runs strategies with overrides and builds all files", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "econ-"));
    const file = path.join(dir, "o.json");
    writeFileSync(file, JSON.stringify({ loot: { sellBackPct: 10 } }));
    const out = runSimulation(
      {
        ...parseCliArgs([
          "--runs",
          "3",
          "--strategy",
          "balanced",
          "--nights",
          "99",
        ]),
        overridesFile: file,
        sets: ["waves.1.rewardGold=50"],
      },
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(out.summaries).toHaveLength(1);
    expect(out.summaries[0]!.nights[0]!.rewardGold).toBe(50);
    expect(out.meta.overrides).toEqual([
      `file:${file}`,
      "waves.1.rewardGold=50",
    ]);
    expect(Object.keys(out.files).sort()).toEqual([
      "nights.csv",
      "report.html",
      "runs.csv",
      "summary.json",
    ]);
    expect(JSON.parse(out.files["summary.json"]!).meta.generatedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("writes reports to the output folder", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "econ-"));
    const lines: string[] = [];
    const code = main(
      ["--runs", "2", "--strategy", "no-spend", "--out", dir],
      (l) => lines.push(l),
    );
    expect(code).toBe(0);
    expect(readdirSync(dir).sort()).toEqual([
      "nights.csv",
      "report.html",
      "runs.csv",
      "summary.json",
    ]);
    expect(lines.join("\n")).toMatch(/no-spend: Never buy/);
    expect(lines.at(-1)).toMatch(/Wrote /);
    expect(readFileSync(path.join(dir, "report.html"), "utf8")).toMatch(/<svg/);
    const quiet: string[] = [];
    main(
      ["--runs", "1", "--strategy", "no-spend", "--out", dir, "--quiet"],
      (l) => quiet.push(l),
    );
    expect(quiet).toHaveLength(1);
  });

  it("checks fixed-seed bands and writes them", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "econ-bands-"));
    const file = path.join(dir, "bands.json");
    const lines: string[] = [];
    const run = (extra: string[]) =>
      main(
        [
          "--runs",
          "2",
          "--strategy",
          "no-spend",
          "--out",
          dir,
          "--quiet",
          ...extra,
        ],
        (l) => lines.push(l),
      );
    expect(run(["--write-bands", file])).toBe(0);
    expect(readFileSync(file, "utf8")).toMatch(/"strategies"/);
    expect(run(["--bands", file])).toBe(0);
    expect(lines.join("\n")).toMatch(/within its bands/);
    const bands = JSON.parse(readFileSync(file, "utf8"));
    bands.strategies["no-spend"].finalPowerRatioP50 = 999;
    const broken = path.join(dir, "broken.json");
    writeFileSync(broken, JSON.stringify(bands));
    expect(run(["--bands", broken])).toBe(1);
    expect(lines.join("\n")).toMatch(/outside its bands/);
    const parsed = parseCliArgs([
      "--bands",
      "a.json",
      "--write-bands",
      "b.json",
    ]);
    expect(parsed.bands).toBe("a.json");
    expect(parsed.writeBands).toBe("b.json");
  });

  it("prints usage for --help and bad options", () => {
    const lines: string[] = [];
    expect(main(["--help"], (l) => lines.push(l))).toBe(0);
    expect(lines[0]).toBe(USAGE);
    expect(main(["--strategy", "nope"], (l) => lines.push(l))).toBe(2);
    expect(lines[1]).toMatch(/Unknown --strategy/);
  });

  it("logs to stdout by default", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    try {
      expect(main(["--help"])).toBe(0);
      expect(spy).toHaveBeenCalledWith(`${USAGE}\n`);
    } finally {
      spy.mockRestore();
    }
  });
});
