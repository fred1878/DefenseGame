import { expect, test } from "@playwright/test";
import { e2eApi, gotoE2E, startDefense } from "./helpers/game";

const SCROLL_POLL_OPTS = { timeout: 15_000 };

test.describe("defense vertical camera scroll", () => {
  test("camera scroll shifts vertically on tall map and stays within the field horizontally", async ({
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

    const afterNorthY = await api.eval<number>(
      "api.getDefenseCameraScroll().y",
    );

    // South band far from center spawn (y = 0) so scroll must differ from north.
    const southY = halfH - 96;
    await api.eval<void>("api.setPlayerPosition(0, arg)", southY);

    await expect
      .poll(
        async () => api.eval<number>("api.getDefenseCameraScroll().y"),
        SCROLL_POLL_OPTS,
      )
      .not.toBe(afterNorthY);

    const playWidth = (
      await api.eval<{ playArea: { width: number } }>(
        "api.getDefenseHudLayoutProbe()",
      )
    ).playArea.width;

    await api.eval<void>("api.setPlayerPosition(arg, 0)", halfW - 48);

    // The field is wider than the portrait play band (9 x 64px tiles = 576px
    // vs 540px), so the camera pans horizontally too. It must stop at the
    // field edge: the world-bounds clamp keeps scrollX at halfW - playWidth.
    await expect
      .poll(
        async () => api.eval<number>("api.getDefenseCameraScroll().x"),
        SCROLL_POLL_OPTS,
      )
      .toBe(halfW - playWidth);
  });
});
