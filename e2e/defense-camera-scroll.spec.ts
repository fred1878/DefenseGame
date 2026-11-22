import { expect, test } from "@playwright/test";
import { e2eApi, gotoE2E, startDefense } from "./helpers/game";

const SCROLL_POLL_OPTS = { timeout: 15_000 };

test.describe("defense vertical camera scroll", () => {
  test("camera scroll shifts vertically on tall map but not horizontally", async ({
    page,
  }) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);

    const halfH = await api.eval<number>("api.getDefenseHalfHeight()");
    const halfW = await api.eval<number>("api.getDefenseHalfWidth()");

    const before = await api.eval<{ x: number; y: number }>(
      "api.getDefenseCameraScroll()",
    );

    const northY = -halfH + 200;
    await api.eval<void>("api.setPlayerPosition(0, arg)", northY);

    await expect
      .poll(
        async () => api.eval<number>("api.getDefenseCameraScroll().y"),
        SCROLL_POLL_OPTS,
      )
      .not.toBe(before.y);

    const afterNorthY = await api.eval<number>("api.getDefenseCameraScroll().y");

    // South band far from center spawn (y = 0) so scroll must differ from north.
    const southY = halfH - 96;
    await api.eval<void>("api.setPlayerPosition(0, arg)", southY);

    await expect
      .poll(
        async () => api.eval<number>("api.getDefenseCameraScroll().y"),
        SCROLL_POLL_OPTS,
      )
      .not.toBe(afterNorthY);

    await api.eval<void>("api.setPlayerPosition(arg, 0)", halfW - 48);

    await expect
      .poll(
        async () => api.eval<number>("api.getDefenseCameraScroll().x"),
        SCROLL_POLL_OPTS,
      )
      .toBe(before.x);
  });
});