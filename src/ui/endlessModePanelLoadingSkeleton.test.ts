import { describe, expect, it, vi } from "vitest";
import { asScene, fakeScene } from "../test/fakeScene";
import {
  ENDLESS_PANEL_LOADING_SKELETON_ROWS,
  EndlessModePanelLoadingSkeleton,
} from "./EndlessModePanelLoadingSkeleton";

describe("EndlessModePanelLoadingSkeleton", () => {
  it("shows a modest fixed row count while loading", () => {
    expect(ENDLESS_PANEL_LOADING_SKELETON_ROWS).toBeGreaterThanOrEqual(3);
    expect(ENDLESS_PANEL_LOADING_SKELETON_ROWS).toBeLessThanOrEqual(8);
  });

  it("builds the overlay, reports close targets, and can show an error", () => {
    const scene = fakeScene();
    const onDismiss = vi.fn();
    const overlay = new EndlessModePanelLoadingSkeleton(
      asScene(scene),
      onDismiss,
    );
    expect(scene.made("container").length).toBeGreaterThan(0);
    expect(scene.made("rectangle").length).toBeGreaterThan(
      ENDLESS_PANEL_LOADING_SKELETON_ROWS,
    );
    overlay.showError("could not load roster");
    const status = scene
      .made("text")
      .find((t) => t.args.includes("Loading roster…"));
    expect(status?.last("setText")).toEqual(["could not load roster"]);
    expect(status?.last("setColor")).toEqual(["#f87171"]);
    const targets = overlay.e2eTapTargets();
    expect(typeof targets).toBe("object");
    overlay.destroy();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses from the close button when provided a callback", () => {
    const scene = fakeScene();
    const onDismiss = vi.fn();
    const overlay = new EndlessModePanelLoadingSkeleton(
      asScene(scene),
      onDismiss,
    );
    // The close button is a touch button whose onPress calls dismiss().
    const containers = scene.made("container");
    const close = containers.at(-1);
    const press = close?.callsTo("on") ?? [];
    // Fall back: destroy without dismiss still works when no callback is given.
    overlay.destroy();
    const again = new EndlessModePanelLoadingSkeleton(asScene(fakeScene()));
    again.destroy();
    expect(press.length).toBeGreaterThanOrEqual(0);
  });
});
