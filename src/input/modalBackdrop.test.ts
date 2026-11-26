import { describe, expect, it, vi } from "vitest";
import { acquireModalInput, bindModalDimBackdrop } from "./modalBackdrop";
import * as inputModality from "./inputModality";

describe("acquireModalInput", () => {
  it("pops the modality only the first time release is called", () => {
    const pop = vi
      .spyOn(inputModality, "popInputModality")
      .mockImplementation(() => undefined);
    const push = vi
      .spyOn(inputModality, "pushInputModality")
      .mockImplementation(() => undefined);
    const lease = acquireModalInput({} as never, {
      id: "modal-test",
      layer: "modal",
    });
    expect(push).toHaveBeenCalled();
    lease.release();
    lease.release();
    expect(pop).toHaveBeenCalledTimes(1);
    push.mockRestore();
    pop.mockRestore();
  });
});

describe("bindModalDimBackdrop", () => {
  it("is a visual-only hook", () => {
    expect(() => bindModalDimBackdrop({} as never)).not.toThrow();
  });
});
