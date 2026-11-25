import { describe, expect, it, vi } from "vitest";
import { setContainerInputEnabled } from "./setContainerInputEnabled";

describe("setContainerInputEnabled", () => {
  it("enables and disables pointer input on the container", () => {
    const container = {
      setInteractive: vi.fn(),
      disableInteractive: vi.fn(),
    } as unknown as Phaser.GameObjects.Container;

    setContainerInputEnabled(container, true);
    expect(container.setInteractive).toHaveBeenCalledOnce();
    expect(container.disableInteractive).not.toHaveBeenCalled();

    setContainerInputEnabled(container, false);
    expect(container.disableInteractive).toHaveBeenCalledOnce();
  });
});
