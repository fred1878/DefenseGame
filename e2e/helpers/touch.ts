import { type Page, expect } from "@playwright/test";

const GAME_W = 540;
const GAME_H = 1200;

export async function canvasLocator(page: Page) {
  return page.locator("#game canvas");
}

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

/** Press at game coords, drag to another point, release (Phaser pointer events). */
export async function dragCanvas(
  page: Page,
  fromGameX: number,
  fromGameY: number,
  toGameX: number,
  toGameY: number,
): Promise<void> {
  const canvas = await canvasLocator(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounding box missing");
  const from = await gameToCanvasPosition(page, fromGameX, fromGameY);
  const to = await gameToCanvasPosition(page, toGameX, toGameY);
  const startX = box.x + from.x;
  const startY = box.y + from.y;
  const endX = box.x + to.x;
  const endY = box.y + to.y;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
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