import { describe, expect, it } from "vitest";
import { GAME } from "../../config";
import { saveMenuLayout, saveMenuRowCenterY } from "./saveMenuLayout";

describe("saveMenuLayout", () => {
  const l = saveMenuLayout();

  it("lists the buttons in creation order", () => {
    expect(l.buttons.map((b) => b.id)).toEqual([
      "save",
      "load",
      "delete",
      "confirm",
      "cancel",
      "close",
    ]);
  });

  it("centres the slot list and stacks rows by height + gap", () => {
    expect(l.listLeft * 2 + l.rowW).toBeCloseTo(GAME.width);
    expect(saveMenuRowCenterY(l, 1) - saveMenuRowCenterY(l, 0)).toBeCloseTo(
      l.rowH + l.gap,
    );
  });

  it("action row shares one y; Close sits below it", () => {
    const [save, load, del, confirm, cancel, close] = l.buttons;
    for (const b of [load, del, confirm, cancel]) expect(b?.y).toBe(save?.y);
    expect(close?.y ?? 0).toBeGreaterThan(save?.y ?? 0);
    expect(load?.x).toBeCloseTo(GAME.width / 2);
    expect((save?.x ?? 0) + (del?.x ?? 0)).toBeCloseTo(GAME.width);
    expect((confirm?.x ?? 0) + (cancel?.x ?? 0)).toBeCloseTo(GAME.width);
  });
});
