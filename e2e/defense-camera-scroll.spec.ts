import { expect, test } from "@playwright/test";
import { defenseHalfHeight } from "../src/config/defense";
import { e2eApi, gotoE2E, startDefense } from "./helpers/game";

test.describe("defense vertical camera scroll", () => {
  test("camera scrollY shifts when player moves north on tall map", async ({
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
  });
});