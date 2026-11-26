import { describe, expect, it, vi } from "vitest";
import { GAME } from "../../config";
import * as touchButton from "../touchButton";
import type { EnemyRow } from "./EndlessModePanelBuild";
import {
  endlessPanelE2eScrollState,
  endlessPanelE2eTapTargets,
} from "./EndlessModePanelE2E";
import type { EndlessModePanelScroll } from "./EndlessModePanelScroll";

function scrollStub(opts: {
  center?: { x: number; y: number } | null;
  minus?: { x: number; y: number } | null;
  plus?: { x: number; y: number } | null;
}): EndlessModePanelScroll {
  return {
    rowScreenCenter: () => opts.center ?? null,
    capControlCenter: (_row: EnemyRow, which: "minus" | "plus") =>
      which === "minus" ? (opts.minus ?? null) : (opts.plus ?? null),
  } as unknown as EndlessModePanelScroll;
}

const row = { enemyId: "grunt" } as EnemyRow;

const base = {
  rows: [row],
  startBtn: null,
  closeBtn: null,
  infiniteHpRowY: 10,
  challengeRatingY: 20,
};

describe("endlessPanelE2eTapTargets leftover branches", () => {
  it("skips a row with no screen center", () => {
    const out = endlessPanelE2eTapTargets({
      ...base,
      scroll: scrollStub({ center: null }),
    });
    expect(out["endless-enemy-grunt"]).toBeUndefined();
    expect(out["endless-infinite-hp"]).toEqual({
      x: GAME.width / 2,
      y: 10,
    });
    expect(out["endless-challenge-rating"]).toEqual({
      x: GAME.width / 2,
      y: 20,
    });
  });

  it("omits cap targets when cap centers are missing", () => {
    const out = endlessPanelE2eTapTargets({
      ...base,
      scroll: scrollStub({
        center: { x: 1, y: 2 },
        minus: null,
        plus: null,
      }),
    });
    expect(out["endless-enemy-grunt"]).toEqual({ x: 1, y: 2 });
    expect(out["endless-cap-minus-grunt"]).toBeUndefined();
    expect(out["endless-cap-plus-grunt"]).toBeUndefined();
    expect(out["endless-start"]).toBeUndefined();
    expect(out["endless-close"]).toBeUndefined();
  });

  it("omits start and close when the buttons have no screen rect", () => {
    const rect = vi
      .spyOn(touchButton, "interactiveObjectScreenRect")
      .mockReturnValue(null);
    const btn = { container: {} };
    const out = endlessPanelE2eTapTargets({
      ...base,
      rows: [],
      scroll: scrollStub({}),
      startBtn: btn as never,
      closeBtn: btn as never,
    });
    expect(out["endless-start"]).toBeUndefined();
    expect(out["endless-close"]).toBeUndefined();
    rect.mockRestore();
  });
});

describe("endlessPanelE2eScrollState", () => {
  it("flags the scrollbar from maxScroll", () => {
    const state = endlessPanelE2eScrollState(12, {
      listTop: 200,
      listViewportH: 400,
      rowH: 50,
      rowStride: 60,
      contentHeight: 500,
      maxScroll: 100,
      rowW: 400,
      nameColW: 300,
      capColW: 100,
      listLeft: 70,
      capColLeft: 370,
    });
    expect(state.scrollY).toBe(12);
    expect(state.scrollbarVisible).toBe(true);
  });
});
