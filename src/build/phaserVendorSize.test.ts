import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";

/**
 * Fast guard on the committed vendor UMD (production phaser chunk tracks this within ~5%).
 * Baseline gzip bytes — update when rebuilding vendor/phaser-defense.js on purpose.
 */
/** Phaser 4.2.1 custom build (3.90 trimmed build was 915_464; v4 renderer + filters are larger). */
const VENDOR_BASELINE_GZIP = 1_077_206;
const MAX_REGRESSION_RATIO = 1.05;

describe("phaser custom vendor bundle", () => {
  it("vendor/phaser-defense.js gzip stays within 5% of baseline", () => {
    const vendorPath = path.join(process.cwd(), "vendor/phaser-defense.js");
    expect(fs.existsSync(vendorPath), "run npm run build:phaser").toBe(true);
    const raw = fs.readFileSync(vendorPath);
    const gzip = zlib.gzipSync(raw).length;
    const limit = Math.ceil(VENDOR_BASELINE_GZIP * MAX_REGRESSION_RATIO);
    expect(gzip).toBeLessThanOrEqual(limit);
  });

  it("manifest matches installed phaser version", () => {
    const manifestPath = path.join(process.cwd(), "vendor/phaser-defense.manifest.json");
    const phaserPkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "node_modules/phaser/package.json"), "utf8"),
    ) as { version: string };
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      phaserVersion: string;
    };
    expect(manifest.phaserVersion).toBe(phaserPkg.version);
  });
});