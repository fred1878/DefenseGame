import { describe, expect, it, vi } from "vitest";
import { scaleUiY } from "../../core/displayScale";
import { FakeEmitter, fakePointer } from "../../test/fakeInput";
import type { PlannerRow, WavePlannerListLayout } from "./WavePlannerPanelBuild";
import { WavePlannerPanelScroll } from "./WavePlannerPanelScroll";

const layout: WavePlannerListLayout = {
  listTop: 200,
  listViewportH: 300,
  contentHeight: 8 * 60,
  rowStride: 60,
  numericColLeft: 300,
  maxScroll: 8 * 60 - 300,
};

function bar() {
  return { width: 6, y: 0, setVisible: vi.fn(), setDisplaySize: vi.fn() };
}

function setup(overrides: Partial<WavePlannerListLayout> = {}) {
  const input = new FakeEmitter();
  const scene = { input } as unknown as Phaser.Scene;
  const onTapRow = vi.fn();
  const rows = Array.from({ length: 8 }, (_, i) => ({ enemyId: `w${i}` })) as unknown as PlannerRow[];
  const view = {
    listContent: { y: layout.listTop },
    scrollTrack: bar(),
    scrollThumb: bar(),
    layout: { ...layout, ...overrides },
    rows,
  };
  const scroll = new WavePlannerPanelScroll(scene, onTapRow);
  scroll.attach(view as never);
  const viewport = new FakeEmitter();
  scroll.wireListViewportDrag(viewport as never);
  return { scroll, view, input, viewport, onTapRow };
}

describe("WavePlannerPanelScroll", () => {
  it("clamps scroll and lays out the thumb", () => {
    const { scroll, view } = setup();
    scroll.applyScroll(500);
    expect(view.listContent.y).toBe(200 - layout.maxScroll);
    const thumbH = Math.max(scaleUiY(28), (300 / layout.contentHeight) * 300);
    expect(view.scrollThumb.setDisplaySize).toHaveBeenLastCalledWith(6, thumbH);
    expect(view.scrollThumb.y).toBeCloseTo(200 + (300 - thumbH));
    scroll.applyScroll(-10);
    expect(view.listContent.y).toBe(200);
    expect(view.scrollThumb.y).toBeCloseTo(200);
  });

  it("hides the scrollbar when nothing scrolls", () => {
    const { scroll, view } = setup({ maxScroll: 0 });
    scroll.applyScroll(40);
    expect(view.listContent.y).toBe(200);
    expect(view.scrollTrack.setVisible).toHaveBeenLastCalledWith(false);
  });

  it("wheel scrolls while bound", () => {
    const { scroll, input, view } = setup();
    scroll.bindWheel();
    input.emit("wheel", {}, [], 0, 100);
    expect(view.listContent.y).toBeCloseTo(200 - 35);
    scroll.unbindWheel();
    input.emit("wheel", {}, [], 0, 100);
    expect(view.listContent.y).toBeCloseTo(200 - 35);
  });

  it("drag on the viewport scrolls without toggling a row", () => {
    const { viewport, view, onTapRow } = setup();
    viewport.emit("pointerdown", fakePointer(100, 400));
    viewport.emit("pointermove", fakePointer(100, 340));
    expect(view.listContent.y).toBe(140);
    viewport.emit("pointerup", fakePointer(100, 340));
    expect(onTapRow).not.toHaveBeenCalled();
  });

  it("a tap on the name column toggles the row under it", () => {
    const { viewport, onTapRow } = setup();
    viewport.emit("pointerdown", fakePointer(100, 330));
    viewport.emit("pointerup", fakePointer(100, 330));
    expect(onTapRow).toHaveBeenCalledWith("w2");
  });

  it("ignores taps in the numeric column, outside the list, or from other pointers", () => {
    const { viewport, onTapRow } = setup();
    viewport.emit("pointerdown", fakePointer(320, 330));
    viewport.emit("pointerup", fakePointer(320, 330));
    viewport.emit("pointerdown", fakePointer(100, 150));
    viewport.emit("pointerup", fakePointer(100, 150));
    viewport.emit("pointerdown", fakePointer(100, 330, 1));
    viewport.emit("pointermove", fakePointer(100, 200, 2));
    viewport.emit("pointerup", fakePointer(100, 330, 2));
    expect(onTapRow).not.toHaveBeenCalled();
  });
});
