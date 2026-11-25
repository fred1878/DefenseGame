import { type Page, expect } from "@playwright/test";

const GAME_W = 540;
const GAME_H = 1200;

export async function canvasLocator(page: Page) {
  return page.locator("#game canvas");
}

export type CanvasBox = { x: number; y: number; width: number; height: number };

/** Map Phaser pointer coords (540×1200) to an offset within the canvas element. */
export async function gameToCanvasPosition(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<{ x: number; y: number }> {
  const box = await (await canvasLocator(page)).boundingBox();
  if (!box) throw new Error("Canvas bounding box missing");
  return {
    x: (gameX / GAME_W) * box.width,
    y: (gameY / GAME_H) * box.height,
  };
}

/**
 * Press at game coords, drag to another point, release (Phaser pointer events).
 *
 * Reads the canvas box once: each extra protocol round trip waits on the
 * renderer, which is slow under CI's software WebGL when a modal panel is open.
 */
export async function dragCanvas(
  page: Page,
  fromGameX: number,
  fromGameY: number,
  toGameX: number,
  toGameY: number,
  {
    steps = 8,
    canvasBox,
  }: {
    steps?: number;
    /** Canvas page rect already read in-page (skips a `boundingBox()` round trip). */
    canvasBox?: CanvasBox;
  } = {},
): Promise<void> {
  const box = canvasBox ?? (await (await canvasLocator(page)).boundingBox());
  if (!box) throw new Error("Canvas bounding box missing");
  const startX = box.x + (fromGameX / GAME_W) * box.width;
  const startY = box.y + (fromGameY / GAME_H) * box.height;
  const endX = box.x + (toGameX / GAME_W) * box.width;
  const endY = box.y + (toGameY / GAME_H) * box.height;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps });
  await page.mouse.up();
}

export async function tapCanvas(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const canvas = await canvasLocator(page);
  const pos = await gameToCanvasPosition(page, gameX, gameY);
  const hasTouch = await page.evaluate(
    () => "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0,
  );
  const opts = { position: pos, force: true as const };
  if (hasTouch) {
    await canvas.tap(opts);
  } else {
    await canvas.click(opts);
  }
}

/** Hold pointer down at game coords without releasing (press-scale feedback). */
export async function holdCanvas(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const canvas = await canvasLocator(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounding box missing");
  const pos = await gameToCanvasPosition(page, gameX, gameY);
  await page.mouse.move(box.x + pos.x, box.y + pos.y);
  await page.mouse.down();
}

export async function releasePointer(page: Page): Promise<void> {
  await page.mouse.up();
}

export async function getTapTarget(
  page: Page,
  testId: string,
): Promise<{ x: number; y: number }> {
  const pt = await page.evaluate((id) => {
    const targets = window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
    const t = targets[id];
    if (!t) throw new Error(`Missing tap target ${id}`);
    return t;
  }, testId);
  return pt;
}

export async function waitForTapTargets(
  page: Page,
  ids: string[],
): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate((wanted) => {
          const targets =
            window.__DEFENSEGAME_E2E__?.api?.getUiTapTargets() ?? {};
          return wanted.every((id) => targets[id] != null);
        }, ids),
      { timeout: 20_000 },
    )
    .toBe(true);
}