import { describe, expect, it } from "vitest";
import { asScene, fakeScene } from "../../test/fakeScene";
import { TownDefenseLoadingOverlay } from "./TownDefenseLoadingOverlay";

describe("TownDefenseLoadingOverlay", () => {
  it("renders a full-screen gate, shows errors, and releases input on destroy", () => {
    const scene = fakeScene();
    const overlay = new TownDefenseLoadingOverlay(asScene(scene));
    expect(scene.made("container").length).toBe(1);
    expect(scene.made("rectangle").length).toBe(1);
    expect(scene.made("text").length).toBe(2);
    const status = scene.made("text")[1]!;
    overlay.showError("prefetch failed");
    expect(status.last("setText")).toEqual(["prefetch failed"]);
    expect(status.last("setColor")).toEqual(["#f87171"]);
    overlay.destroy();
    expect(scene.made("container")[0]!.destroyed).toBe(true);
  });
});
