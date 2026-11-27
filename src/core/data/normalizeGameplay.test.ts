import { describe, expect, it } from "vitest";
import shipped from "../../../public/data/gameplay.json";
import { ConfigLoadError } from "./configValidation";
import { GAMEPLAY_SECTION_KEYS, normalizeGameplay } from "./normalizeGameplay";

describe("normalizeGameplay", () => {
  it("reads every section of the shipped file", () => {
    const out = normalizeGameplay(shipped);
    for (const [section, keys] of Object.entries(GAMEPLAY_SECTION_KEYS)) {
      for (const key of keys) {
        expect(
          typeof (out as Record<string, Record<string, number>>)[section]![key],
        ).toBe("number");
      }
    }
    expect(out.wall.baseHp).toBe(100);
  });

  it("names the missing section or field", () => {
    expect(() => normalizeGameplay(null)).toThrow(ConfigLoadError);
    const { wall: _wall, ...noWall } = shipped;
    expect(() => normalizeGameplay(noWall)).toThrow(/gameplay\.wall/);
    expect(() =>
      normalizeGameplay({
        ...shipped,
        spawn: { ...shipped.spawn, jitterYWu: "x" },
      }),
    ).toThrow(/gameplay\.spawn\.jitterYWu/);
  });
});
