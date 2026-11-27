import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { scaleUiY } from "../../config/uiScale";
import { FakeEmitter, fakePointer } from "../../test/fakeInput";
import type { EndlessListLayout, EnemyRow } from "./EndlessModePanelBuild";
import * as endlessModePanelPick from "../panels/endlessModePanelPick";
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
  const listContentY = layout.listTop;
  const rows = Array.from({ length: ROWS }, (_, i) => {
    const rowY = i * 60 + 25;
    const matrix = {
      tx: 150,
      ty: listContentY + rowY,
      scaleX: 1,
      scaleY: 1,
    };
    const bg = {
      x: 150,
      y: rowY,
      scaleX: 1,
      scaleY: 1,
      displayOriginX: layout.nameColW / 2,
      displayOriginY: layout.rowH / 2,
      scrollFactorX: 0,
      scrollFactorY: 0,
      scene: {
        cameras: {
          main: { scrollX: 0, scrollY: 0, rotation: 0, zoomX: 1, zoomY: 1 },
        },
      },
      getWorldTransformMatrix(temp: typeof matrix) {
        Object.assign(temp, matrix);
        return temp;
      },
    };
    return {
      enemyId: `e${i}`,
      bg,
      capBg: { y: rowY },
      capMinus: { x: 390 },
      capPlus: { x: 450 },
    };
  }) as unknown as EnemyRow[];
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

  it("viewport scroll catcher claims the full roster viewport band", () => {
    const { scroll } = setup();
    const { listLeft, rowW, listTop, listViewportH } = layout;
    expect(scroll.listViewportHitForScroll(69, 300)).toBe(false); // left of list
    expect(scroll.listViewportHitForScroll(100, 150)).toBe(false); // above list
    expect(scroll.listViewportHitForScroll(100, 210)).toBe(true); // on row 0 name
    expect(scroll.listViewportHitForScroll(380, 210)).toBe(true); // on row 0 cap
    expect(scroll.listViewportHitForScroll(100, 255)).toBe(true); // gap 0/1
    expect(scroll.listViewportHitForScroll(380, 255)).toBe(true); // gap 0/1
    expect(scroll.listViewportHitForScroll(listLeft + 1, listTop)).toBe(true);
    expect(
      scroll.listViewportHitForScroll(
        listLeft + rowW - 1,
        listTop + listViewportH,
      ),
    ).toBe(true);
  });

  it("reports row and cap centers only while visible", () => {
    const { scroll, rows } = setup();
    expect(scroll.rowScreenCenter(rows[0]!)).toEqual({ x: 150, y: 225 });
    expect(scroll.capControlCenter(rows[0]!, "plus")).toEqual({
      x: 450,
      y: 225,
    });
    expect(scroll.rowScreenCenter(rows[9]!)).toBeNull();
    expect(scroll.capControlCenter(rows[9]!, "minus")).toBeNull();
    scroll.applyScroll(layout.maxScroll);
    expect(scroll.rowScreenCenter(rows[0]!)).toBeNull();
    expect(scroll.rowScreenCenter(rows[9]!)).not.toBeNull();
  });

  it("row hit tests follow the clipped viewport across the full cell", () => {
    const { scroll, rows } = setup();
    const nameHit = scroll.rowNameHitTest(rows[0]!);
    const rowHit = new Phaser.Geom.Rectangle(
      -layout.nameColW / 2,
      -layout.rowH / 2,
      layout.nameColW,
      layout.rowH,
    );
    const capHit = new Phaser.Geom.Rectangle(
      -layout.capColW / 2,
      -layout.rowH / 2,
      layout.capColW,
      layout.rowH,
    );
    const halfW = layout.nameColW / 2;
    const halfH = layout.rowH / 2;
    for (const lx of [-halfW, 0, halfW]) {
      for (const ly of [-halfH, 0, halfH]) {
        expect(nameHit(rowHit, lx, ly, rows[0]!.bg as never)).toBe(true);
      }
    }
    expect(nameHit(rowHit, 0, 0, rows[9]!.bg as never)).toBe(false);
    expect(scroll.rowCapHitTest(rows[0]!)(capHit, 0, 0)).toBe(true);
    expect(scroll.rowCapHitTest(rows[9]!)(capHit, 0, 0)).toBe(false);
  });
});

describe("EndlessModePanelScroll leftover branches", () => {
  it("ignores a move from another pointer and a second listener attach", () => {
    const { scroll, input } = setup();
    scroll.beginDrag(fakePointer(100, 300, 1) as never, "row", "e2");
    input.emit("pointermove", fakePointer(100, 250, 2));
    expect(scroll.scrollY).toBe(0);
    scroll.beginDrag(fakePointer(100, 300, 1) as never, "row", "e2");
    input.emit("pointermove", fakePointer(100, 250, 1));
    expect(scroll.scrollY).toBe(50);
  });

  it("does not toggle a row when a viewport tap has no enemy under it", () => {
    const { scroll, input, onTapRow } = setup();
    scroll.beginDrag(fakePointer(100, 10) as never, "viewport");
    input.emit("pointerup", fakePointer(100, 10));
    expect(onTapRow).not.toHaveBeenCalled();
  });

  it("rejects name and cap hits outside the hit area or off the roster", () => {
    const { scroll, rows } = setup();
    const nameHit = scroll.rowNameHitTest(rows[0]!);
    const capHit = scroll.rowCapHitTest(rows[0]!);
    const area = new Phaser.Geom.Rectangle(-150, -25, 300, 50);
    const contains = vi
      .spyOn(Phaser.Geom.Rectangle, "Contains")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    expect(nameHit(area, 400, 0, rows[0]!.bg as never)).toBe(false);
    expect(capHit(area, 10_000, 10_000)).toBe(false);
    contains.mockRestore();
    const ghost = { ...rows[0]!, enemyId: "ghost" } as (typeof rows)[0];
    const ghostHit = scroll.rowNameHitTest(ghost);
    expect(ghostHit(area, 0, 0, rows[0]!.bg as never)).toBe(false);
  });

  it("rejects a name hit whose local point has no screen mapping", () => {
    const { scroll, rows } = setup();
    const nameHit = scroll.rowNameHitTest(rows[0]!);
    const area = new Phaser.Geom.Rectangle(-150, -25, 300, 50);
    const ghost = { x: 0, y: 0 } as never;
    expect(nameHit(area, 0, 0, ghost)).toBe(false);
  });

  it("rejects a name hit that lands in the cap column", () => {
    const { scroll, rows } = setup();
    const nameHit = scroll.rowNameHitTest(rows[0]!);
    const area = new Phaser.Geom.Rectangle(-150, -25, 300, 50);
    // Local X 250 maps to screen x = 150 + (250 - 150) = 250; still left of
    // capColLeft 370. Use 400: 150 + (400 - 150) = 400 >= 370.
    expect(nameHit(area, 400, 0, rows[0]!.bg as never)).toBe(false);
  });

  it("rejects a name hit when the row has no visible y-band", () => {
    const { scroll, rows } = setup();
    const nameHit = scroll.rowNameHitTest(rows[0]!);
    const area = new Phaser.Geom.Rectangle(-150, -25, 300, 50);
    const band = vi
      .spyOn(endlessModePanelPick, "endlessRowVisibleScreenYBand")
      .mockReturnValue(null);
    expect(nameHit(area, 0, 0, rows[0]!.bg as never)).toBe(false);
    band.mockRestore();
  });
});
