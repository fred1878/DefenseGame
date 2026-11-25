import { afterEach, describe, expect, it, vi } from "vitest";
import { markBoot, measureBoot } from "./bootPerf";

describe("bootPerf", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no-ops when performance is missing", () => {
    vi.stubGlobal("performance", undefined);
    expect(() => markBoot("a")).not.toThrow();
    expect(() => measureBoot("m", "a", "b")).not.toThrow();
  });

  it("no-ops when mark/measure are not functions", () => {
    vi.stubGlobal("performance", {});
    expect(() => markBoot("a")).not.toThrow();
    expect(() => measureBoot("m", "a", "b")).not.toThrow();
  });

  it("records marks and measures", () => {
    const mark = vi.fn();
    const measure = vi.fn();
    vi.stubGlobal("performance", { mark, measure });
    markBoot("start");
    expect(mark).toHaveBeenCalledWith("start");
    measureBoot("span", "start", "end");
    expect(measure).toHaveBeenCalledWith("span", "start", "end");
  });

  it("swallows measure errors when marks are missing", () => {
    const measure = vi.fn(() => {
      throw new Error("no mark");
    });
    vi.stubGlobal("performance", { mark: vi.fn(), measure });
    expect(() => measureBoot("span", "missing", "end")).not.toThrow();
  });
});
