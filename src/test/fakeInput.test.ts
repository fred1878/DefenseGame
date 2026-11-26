import { describe, expect, it } from "vitest";
import { FakeEmitter } from "./fakeInput";

describe("FakeEmitter leftover branches", () => {
  it("reports zero listeners for an event that was never registered", () => {
    expect(new FakeEmitter().listenerCount("pointermove")).toBe(0);
  });
});
