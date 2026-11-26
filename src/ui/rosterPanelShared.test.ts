import { describe, expect, it, vi } from "vitest";
import { setRosterStartEnabled } from "./rosterPanelShared";

describe("setRosterStartEnabled leftover branches", () => {
  it("no-ops when the start button is missing", () => {
    expect(() => setRosterStartEnabled(null, true)).not.toThrow();
  });

  it("dims and disables the start button when the roster is empty", () => {
    const btn = {
      setAlpha: vi.fn(),
      setInteractive: vi.fn(),
      disableInteractive: vi.fn(),
    };
    setRosterStartEnabled({ container: btn } as never, false);
    expect(btn.setAlpha).toHaveBeenCalledWith(0.45);
    expect(btn.disableInteractive).toHaveBeenCalled();
    setRosterStartEnabled({ container: btn } as never, true);
    expect(btn.setAlpha).toHaveBeenCalledWith(1);
    expect(btn.setInteractive).toHaveBeenCalled();
  });
});
