/**
 * Cold-ish first-load timing for DefenseGame (production preview + E2E hooks).
 * Usage: npm run build:e2e && node scripts/measure-first-load.mjs
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const host = process.env.E2E_HOST ?? "127.0.0.1";
const port = process.env.E2E_PORT ?? "4173";
const baseURL = `http://${host}:${port}`;
const runs = Number(process.env.LOAD_RUNS ?? 5);
const profile = process.env.LOAD_PROFILE ?? "localhost";

/** @type {Record<string, { throughput: number, latency: number, cpu: number } | null>} */
const PROFILES = {
  localhost: null,
  Slow4G: {
    throughput: (500 * 1024) / 8,
    latency: 400,
    cpu: 4,
  },
  Fast3G: {
    throughput: (1.6 * 1024 * 1024) / 8,
    latency: 150,
    cpu: 2,
  },
  /** Lighter than Fast3G: decent bandwidth, mild latency, minimal CPU throttle. */
  Mild: {
    throughput: (5 * 1024 * 1024) / 8,
    latency: 40,
    cpu: 1.25,
  },
};

function startPreview() {
  return spawn(
    "npm",
    ["run", "preview", "--", "--port", port, "--host", host],
    {
      cwd: new URL("..", import.meta.url).pathname,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, VITE_BASE: "/" },
    },
  );
}

async function waitForServer(maxMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(baseURL);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Preview server did not start at ${baseURL}`);
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function measureOnce(browser) {
  const context = await browser.newContext({
    viewport: { width: 540, height: 1200 },
    hasTouch: true,
    deviceScaleFactor: 2,
    storageState: undefined,
  });
  await context.clearCookies();
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.clearBrowserCache");
  const throttle = PROFILES[profile];
  if (throttle) {
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: throttle.throughput,
      uploadThroughput: throttle.throughput / 2,
      latency: throttle.latency,
    });
    await client.send("Emulation.setCPUThrottlingRate", { rate: throttle.cpu });
  }

  const requests = [];
  client.on("Network.responseReceived", (ev) => {
    const u = ev.response.url;
    if (u.includes(host) && !u.includes("favicon")) {
      requests.push({
        url: u,
        mime: ev.response.mimeType,
        encoded: ev.response.encodedDataLength,
        fromDisk: ev.response.fromDiskCache,
        fromPrefetch: ev.response.fromPrefetchCache,
      });
    }
  });

  const navStart = Date.now();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${baseURL}/?e2e=1`, { waitUntil: "commit" });
  const navDone = Date.now();

  await page.waitForFunction(
    () => {
      const s = window.__DEFENSEGAME_E2E__;
      return s?.ready === true && s.scene === "Town";
    },
    { timeout: 90_000 },
  );
  const townReady = Date.now();

  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(
      performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]),
    );
    const resources = performance
      .getEntriesByType("resource")
      .filter((r) => !r.name.includes("favicon"))
      .map((r) => ({
        name: r.name.split("/").pop(),
        initiatorType: r.initiatorType,
        transferSize: r.transferSize,
        encodedBodySize: r.encodedBodySize,
        duration: r.duration,
        startTime: r.startTime,
      }));
    const defensegameMeasures = performance
      .getEntriesByType("measure")
      .filter((m) => m.name.startsWith("defensegame:"))
      .map((m) => ({
        name: m.name,
        durationMs: Math.round(m.duration * 10) / 10,
      }));
    const startupMarkNames = [
      "defensegame:phaser-import-end",
      "defensegame:phaser-game-end",
    ];
    const startupMarks = performance
      .getEntriesByType("mark")
      .filter((m) => startupMarkNames.includes(m.name))
      .map((m) => ({
        name: m.name,
        startTimeMs: Math.round(m.startTime * 10) / 10,
      }));
    return {
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      loadEvent: nav?.loadEventEnd ?? 0,
      responseEnd: nav?.responseEnd ?? 0,
      transferSize: nav?.transferSize ?? 0,
      fcp: paints["first-contentful-paint"] ?? null,
      fp: paints["first-paint"] ?? null,
      resourceCount: resources.length,
      bootMeasures: defensegameMeasures,
      startupMarks,
      resources,
    };
  });

  const wallMs = townReady - navStart;
  await context.close();

  const transferBytes = requests.reduce((a, r) => a + (r.encoded || 0), 0);
  const byMime = {};
  for (const r of requests) {
    const m = r.mime?.split(";")[0] || "unknown";
    byMime[m] = (byMime[m] || 0) + 1;
  }

  return {
    townInteractiveMs: wallMs,
    navigationMs: navDone - navStart,
    perf,
    requestCount: requests.length,
    transferBytes,
    byMime,
  };
}

const preview = startPreview();
let previewOut = "";
preview.stdout?.on("data", (d) => {
  previewOut += d;
});
preview.stderr?.on("data", (d) => {
  previewOut += d;
});

try {
  await waitForServer();
  const browser = await chromium.launch();
  const results = [];
  for (let i = 0; i < runs; i++) {
    results.push(await measureOnce(browser));
    process.stderr.write(
      `run ${i + 1}/${runs}: town ready ${results[i].townInteractiveMs}ms\n`,
    );
  }
  await browser.close();

  const townTimes = results.map((r) => r.townInteractiveMs);
  const report = {
    baseURL,
    profile,
    runs,
    townInteractiveMs: {
      min: Math.min(...townTimes),
      median: Math.round(median(townTimes)),
      max: Math.max(...townTimes),
      samples: townTimes,
    },
    lastRun: {
      domContentLoadedMs: Math.round(results.at(-1).perf.domContentLoaded),
      loadEventMs: Math.round(results.at(-1).perf.loadEvent),
      fcpMs: results.at(-1).perf.fcp
        ? Math.round(results.at(-1).perf.fcp)
        : null,
      resourceCount: results.at(-1).perf.resourceCount,
      requestCount: results.at(-1).requestCount,
      transferBytes: results.at(-1).transferBytes,
      byMime: results.at(-1).byMime,
      bootMeasures: results.at(-1).perf.bootMeasures,
      startupMarks: results.at(-1).perf.startupMarks,
    },
    note: "townInteractiveMs = navigation start to __DEFENSEGAME_E2E__.ready && scene===Town (includes JS parse, Phaser boot, asset+JSON load, Town create).",
  };
  console.log(JSON.stringify(report, null, 2));
} catch (err) {
  // Surface the preview server log when a run fails (e.g. port in use).
  process.stderr.write(previewOut);
  throw err;
} finally {
  preview.kill("SIGTERM");
}
