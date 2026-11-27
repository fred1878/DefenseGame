import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeEventData, fakePointer } from "../../test/fakeInput";
import { asScene, fakeScene, type FakeGameObject } from "../../test/fakeScene";
import { FatalErrorPanel, reportFatal } from "./FatalErrorPanel";

type Internals = { buttons: Array<{ container: FakeGameObject }> };

function tap(scene: ReturnType<typeof fakeScene>, c: FakeGameObject) {
  c.emit("pointerdown", fakePointer(0, 0, 1), 0, 0, fakeEventData());
  scene.input.hitTestPointer.mockReturnValueOnce([c]);
  scene.input.emit("pointerup", fakePointer(0, 0, 1));
}

describe("FatalErrorPanel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows title and message with Retry only by default", () => {
    const scene = fakeScene();
    const onRetry = vi.fn();
    const panel = new FatalErrorPanel(asScene(scene), {
      title: "Failed to load data",
      message: "Try again.",
      onRetry,
    });
    const texts = scene.made("text").map((t) => t.args[2]);
    expect(texts).toContain("Failed to load data");
    expect(texts).toContain("Try again.");
    expect((panel as unknown as Internals).buttons).toHaveLength(1);
    expect(panel.isOpen).toBe(true);
  });

  it("Retry closes the panel and then retries once", () => {
    const scene = fakeScene();
    const onRetry = vi.fn();
    const panel = new FatalErrorPanel(asScene(scene), {
      title: "x",
      onRetry,
    });
    const retry = (panel as unknown as Internals).buttons[0]!;
    tap(scene, retry.container);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(panel.isOpen).toBe(false);
    tap(scene, retry.container);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("Close runs onClose instead of retrying", () => {
    const scene = fakeScene();
    const onRetry = vi.fn();
    const onClose = vi.fn();
    const panel = new FatalErrorPanel(asScene(scene), {
      title: "x",
      onRetry,
      onClose,
      closeLabel: "Back",
    });
    const buttons = (panel as unknown as Internals).buttons;
    expect(buttons).toHaveLength(2);
    tap(scene, buttons[1]!.container);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    expect(panel.isOpen).toBe(false);
  });

  it("reportFatal logs the error and opens the panel", () => {
    const scene = fakeScene();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    const panel = reportFatal(asScene(scene), {
      title: "Oops",
      error: err,
      onRetry: () => {},
    });
    expect(log).toHaveBeenCalledWith("Oops", err);
    expect(panel.isOpen).toBe(true);
    panel.destroy();
    panel.destroy();
    expect(panel.isOpen).toBe(false);
  });
});
