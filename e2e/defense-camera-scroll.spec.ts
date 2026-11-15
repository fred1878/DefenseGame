import { expect, test } from "@playwright/test";
import { defenseHalfHeight, defenseHalfWidth } from "../src/config/defense";
import { e2eApi, gotoE2E, startDefense } from "./helpers/game";

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
      .poll(async () =>
        api.eval<number>("api.getDefenseCameraScroll().y"),
      )
      .not.toBe(before.y);

    const southY = defenseHalfHeight() - 200;
    await api.eval<void>("api.setPlayerPosition(0, arg)", southY);

    await expect
      .poll(async () =>
        api.eval<number>("api.getDefenseCameraScroll().y"),
      )
      .not.toBe(before.y);

    await api.eval<void>(
      "api.setPlayerPosition(arg, 0)",
      defenseHalfWidth() - 48,
    );

    await expect
      .poll(async () =>
        api.eval<number>("api.getDefenseCameraScroll().x"),
      )
      .not.toBe(before.x);
  });
});