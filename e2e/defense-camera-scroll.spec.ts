import { expect, test } from "@playwright/test";
import { defenseHalfHeight, defenseHalfWidth } from "../src/config/defense";
import { e2eApi, gotoE2E, startDefense } from "./helpers/game";

const SCROLL_POLL_OPTS = { timeout: 15_000 };

test.describe("defense vertical camera scroll", () => {
  test("camera scroll shifts when player moves on tall/wide map", async ({
    page,
  }) => {
    await gotoE2E(page);
    await startDefense(page);
    const api = e2eApi(page);

    const before = await api.eval<{ x: number; y: number }>(
      "api.getDefenseCameraScroll()",
    );

    const northY = -defenseHalfHeight() + 200;
    await api.eval<void>("api.setPlayerPosition(0, arg)", northY);

    await expect
      .poll(
        async () => api.eval<number>("api.getDefenseCameraScroll().y"),
        SCROLL_POLL_OPTS,
      )
      .not.toBe(before.y);

    const afterNorthY = await api.eval<number>("api.getDefenseCameraScroll().y");

    // South band far from center spawn (y = 0) so scroll must differ from north.
    const southY = defenseHalfHeight() - 96;
    await api.eval<void>("api.setPlayerPosition(0, arg)", southY);

    await expect
      .poll(
        async () => api.eval<number>("api.getDefenseCameraScroll().y"),
        SCROLL_POLL_OPTS,
      )
      .not.toBe(afterNorthY);

    await api.eval<void>(
      "api.setPlayerPosition(arg, 0)",
      defenseHalfWidth() - 48,
    );

    await expect
      .poll(
        async () => api.eval<number>("api.getDefenseCameraScroll().x"),
        SCROLL_POLL_OPTS,
      )
      .not.toBe(before.x);
  });
});