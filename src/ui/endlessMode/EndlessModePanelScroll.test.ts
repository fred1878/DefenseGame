import { describe, expect, it, vi } from "vitest";
import { scaleUiY } from "../../core/displayScale";
import { FakeEmitter, fakePointer } from "../../test/fakeInput";
import type { EndlessListLayout, EnemyRow } from "./EndlessModePanelBuild";
import { EndlessModePanelScroll } from "./EndlessModePanelScroll";

const ROWS = 10;
const layout: EndlessListLayout = {
  listTop: 200,
  listViewportH: 400,
  rowH: 50,
  rowStride: 60,
  contentHeight: ROWS * 60 - 10,
  maxScroll: ROWS * 60 - 10 - 400,
  rowW: 400,
  nameColW: 300,
  capColW: 100,
  listLeft: 70,
  capColLeft: 370,
};

function bar() {
  return { width: 6, y: 0, setVisible: vi.fn(), setDisplaySize: vi.fn() };
}

function setup(overrides: Partial<EndlessListLayout> = {}) {
  const input = new FakeEmitter();
  const scene = { input } as unknown as Phaser.Scene;
  const onTapRow = vi.fn();
  const rows = Array.from({ length: ROWS }, (_, i) => ({
    enemyId: `e${i}`,
    bg: { x: 150, y: i * 60 + 25 },
    capBg: { y: i * 60 + 25 },
    capMinus: { x: 390 },
    capPlus: { x: 450 },
  })) as unknown as EnemyRow[];
  const view = {
    listContent: { y: layout.listTop },
    scrollTrack: bar(),
    scrollThumb: bar(),
    layout: { ...layout, ...overrides },
    rows,
  };
  const scroll = new EndlessModePanelScroll(scene, onTapRow);
  scroll.attach(view as never);
  return { scroll, view, input, onTapRow, rows };
}

describe("EndlessModePanelScroll", () => {
  it("clamps scroll and moves the list content", () => {
    const { scroll, view } = setup();
    scroll.applyScroll(-50);
    expect(scroll.scrollY).toBe(0);
    expect(view.listContent.y).toBe(200);
    scroll.applyScroll(10_000);
    expect(scroll.scrollY).toBe(layout.maxScroll);
    expect(view.listContent.y).toBe(200 - layout.maxScroll);
  });

  it("sizes and places the scrollbar thumb", () => {
    const { scroll, view } = setup();
    scroll.applyScroll(layout.maxScroll);
    const thumbH = Math.max(scaleUiY(28), (400 / layout.contentHeight) * 400);
    expect(view.scrollTrack.setVisible).toHaveBeenLastCalledWith(true);
    expect(view.scrollThumb.setDisplaySize).toHaveBeenLastCalledWith(6, thumbH);
    expect(view.scrollThumb.y).toBeCloseTo(200 + (400 - thumbH));
  });

  it("hides the scrollbar when the list fits", () => {
    const { scroll, view } = setup({ maxScroll: 0 });
    scroll.applyScroll(30);
    expect(scroll.scrollY).toBe(0);
    expect(view.scrollThumb.setVisible).toHaveBeenLastCalledWith(false);
    expect(view.scrollThumb.setDisplaySize).not.toHaveBeenCalled();
  });

  it("scrolls on wheel until destroyed", () => {
    const { scroll, input } = setup();
    scroll.bindWheel();
    input.emit("wheel", {}, [], 0, 100);
    expect(scroll.scrollY).toBeCloseTo(35);
    input.emit("wheel", {}, [], 0, 0);
    expect(scroll.scrollY).toBeCloseTo(35);
    scroll.destroy();
    input.emit("wheel", {}, [], 0, 100);
    expect(scroll.scrollY).toBeCloseTo(35);
  });

  it("drag scrolls and does not count as a tap", () => {
    const { scroll, input, onTapRow } = setup();
    scroll.beginDrag(fakePointer(100, 300) as never, "row", "e2");
    input.emit("pointermove", fakePointer(100, 250));
    expect(scroll.scrollY).toBe(50);
    input.emit("pointerup", fakePointer(100, 250));
    expect(onTapRow).not.toHaveBeenCalled();
    // Listeners are gone after the drag ends.
    expect(input.listenerCount("pointermove")).toBe(0);
  });

  it("a still press on a row is a tap on that row", () => {
    const { scroll, input, onTapRow } = setup();
    scroll.beginDrag(fakePointer(100, 300) as never, "row", "e3");
    input.emit("pointermove", fakePointer(100, 304));
    input.emit("pointerupoutside", fakePointer(100, 304));
    expect(onTapRow).toHaveBeenCalledWith("e3");
  });

  it("a viewport tap picks the row under the pointer", () => {
    const { scroll, input, onTapRow } = setup();
    scroll.beginDrag(fakePointer(100, 270) as never, "viewport");
    input.emit("pointerup", fakePointer(100, 270));
    expect(onTapRow).toHaveBeenCalledWith("e1");
  });

  it("cap-column taps and other pointers do not toggle rows", () => {
    const { scroll, input, onTapRow } = setup();
    scroll.beginDrag(fakePointer(400, 270, 1) as never, "cap");
    input.emit("pointerup", fakePointer(400, 270, 2));
    input.emit("pointerup", fakePointer(400, 270, 1));
    expect(onTapRow).not.toHaveBeenCalled();
  });

  it("viewport scroll catcher only claims gaps in the name column", () => {
    const { scroll } = setup();
    expect(scroll.listViewportHitForScroll(380, 300)).toBe(false); // cap column
    expect(scroll.listViewportHitForScroll(100, 150)).toBe(false); // above list
    expect(scroll.listViewportHitForScroll(100, 210)).toBe(false); // on row 0
    expect(scroll.listViewportHitForScroll(100, 255)).toBe(true); // gap 0/1
  });

  it("reports row and cap centers only while visible", () => {
    const { scroll, rows } = setup();
    expect(scroll.rowScreenCenter(rows[0]!)).toEqual({ x: 150, y: 225 });
    expect(scroll.capControlCenter(rows[0]!, "plus")).toEqual({ x: 450, y: 225 });
    expect(scroll.rowScreenCenter(rows[9]!)).toBeNull();
    expect(scroll.capControlCenter(rows[9]!, "minus")).toBeNull();
    scroll.applyScroll(layout.maxScroll);
    expect(scroll.rowScreenCenter(rows[0]!)).toBeNull();
    expect(scroll.rowScreenCenter(rows[9]!)).not.toBeNull();
  });

  it("row hit tests follow the clipped viewport", () => {
    const { scroll, rows } = setup();
    const hitArea = {} as Phaser.Geom.Rectangle;
    const nameHit = scroll.rowNameHitTest(rows[0]!);
    // Local (x, y) relative to the row background at x=150, y=25 in content.
    expect(nameHit(hitArea, -50, 0, rows[0]!.bg as never)).toBe(true);
    expect(nameHit(hitArea, 300, 0, rows[0]!.bg as never)).toBe(false);
    expect(scroll.rowCapHitTest(rows[0]!)(hitArea, 0, 0)).toBe(true);
    expect(scroll.rowCapHitTest(rows[9]!)(hitArea, 0, 0)).toBe(false);
  });
});
