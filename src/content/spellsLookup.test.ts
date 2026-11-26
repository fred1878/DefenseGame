import { describe, expect, it } from "vitest";
import { spellById } from "./spells";

describe("spellById", () => {
  it("returns undefined for a blank id", () => {
    expect(spellById("")).toBeUndefined();
  });
});
