#!/usr/bin/env node
/**
 * Rasterise the panel line icons (`scripts/data/ui-icons.json`, Lucide-style
 * 24×24 SVG bodies from the Figma "DG Theme" mockups) into two white-stroke
 * strips under `public/assets/ui/icons/`: `ui-icons-24.png` and
 * `ui-icons-48.png`. Frames are in JSON key order (see `src/ui/icons/uiIcons.ts`);
 * the game tints them at runtime. Re-run after editing the JSON:
 *
 *   node scripts/build-ui-icons.mjs
 *
 * Uses the Playwright Chromium already installed for e2e.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const icons = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/data/ui-icons.json"), "utf8"),
);
const outDir = path.join(root, "public/assets/ui/icons");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [24, 48]) {
  const bodies = Object.values(icons);
  const dataUrl = await page.evaluate(
    async ({ bodies, size }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size * bodies.length;
      canvas.height = size;
      const g = canvas.getContext("2d");
      for (let i = 0; i < bodies.length; i++) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${bodies[i]}</svg>`;
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
        await img.decode();
        g.drawImage(img, i * size, 0, size, size);
      }
      return canvas.toDataURL("image/png");
    },
    { bodies, size },
  );
  const file = path.join(outDir, `ui-icons-${size}.png`);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`wrote ${path.relative(root, file)} (${bodies.length} icons)`);
}
await browser.close();
