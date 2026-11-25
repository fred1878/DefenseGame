import { describe, expect, it, vi } from "vitest";
import type { WaveGroup } from "../core/DataStore";
import { fakeEventData, fakePointer } from "../test/fakeInput";
import { asScene, fakeScene, type FakeGameObject } from "../test/fakeScene";
import { rosterStore } from "../test/rosterStore";
import type { NumField } from "./wavePlanner/WavePlannerPanelBuild";
import { WavePlannerPanel } from "./WavePlannerPanel";

const ids = ["archer", "bruiser", "charger", "grunt"];

type Row = {
  enemyId: string;
  bg: FakeGameObject;
  check: FakeGameObject;
  minus: Record<NumField, FakeGameObject>;
  plus: Record<NumField, FakeGameObject>;
  values: Record<NumField, FakeGameObject>;
};
type Internals = {
  rows: Row[];
  startBtn: { container: FakeGameObject };
  closeBtn: { container: FakeGameObject };
  challengeRatingText: FakeGameObject;
  maskGraphics: FakeGameObject;
  root: FakeGameObject;
  scroll: {
    view: {
      listContent: FakeGameObject;
      layout: { listTop: number; rowStride: number; numericColLeft: number };
    };
  };
};

function open(enemyIds = ids) {
  const scene = fakeScene();
  const onStart = vi.fn<(groups: WaveGroup[]) => void>();
  const onDismiss = vi.fn();
  const panel = new WavePlannerPanel(
    asScene(scene),
    rosterStore(enemyIds),
    onStart,
    onDismiss,
  );
  const ui = panel as unknown as Internals;
  const row = (id: string) => ui.rows.find((r) => r.enemyId === id)!;
  const viewport = scene.created.find((o) =>
    o
      .callsTo("setInteractive")
      .some(
        ([cfg]) =>
          typeof cfg === "object" && cfg !== null && "draggable" in cfg,
      ),
  )!;
  const ptr = (x: number, y: number) => ({
    ...fakePointer(x, y, 1),
    event: fakeEventData(),
  });
  const rowY = (id: string) => {
    const { listContent, layout } = ui.scroll.view;
    const index = ui.rows.findIndex((r) => r.enemyId === id);
    return (listContent.y as number) + (index + 0.5) * layout.rowStride;
  };
  /** Press + release on the list viewport, optionally dragging by `dy`. */
  const listGesture = (x: number, y: number, dy = 0) => {
    viewport.emit("pointerdown", ptr(x, y));
    if (dy) viewport.emit("pointermove", ptr(x, y + dy));
    viewport.emit("pointerup", ptr(x, y + dy));
  };
  const tapRow = (id: string) => listGesture(20, rowY(id));
  const bump = (id: string, field: NumField, dir: "minus" | "plus", n = 1) => {
    for (let i = 0; i < n; i++)
      row(id)[dir][field].emit("pointerup", ptr(0, 0));
  };
  const tapButton = (c: FakeGameObject) => {
    c.emit("pointerdown", fakePointer(0, 0, 1), 0, 0, fakeEventData());
    scene.input.hitTestPointer.mockReturnValueOnce([c]);
    scene.input.emit("pointerup", fakePointer(0, 0, 1));
  };
  const selected = () =>
    ui.rows
      .filter((r) => r.check.last("setText")?.[0] === "☑")
      .map((r) => r.enemyId);
  return {
    scene,
    panel,
    ui,
    row,
    onStart,
    onDismiss,
    tapRow,
    listGesture,
    rowY,
    bump,
    tapButton,
    selected,
  };
}

describe("WavePlannerPanel", () => {
  it("preselects the first enemy, seeding counts from the endless default concurrency", () => {
    const { ui, row, selected } = open();
    expect(ui.rows.map((r) => r.enemyId)).toEqual(ids);
    expect(selected()).toEqual(["archer"]);
    expect(row("archer").values.count.args[2]).toBe("2"); // endlessPanelDefaultConcurrent
    expect(row("archer").values.atMs.args[2]).toBe("0");
    expect(row("archer").values.intervalMs.args[2]).toBe("800");
    expect(ui.challengeRatingText.last("setText")).toEqual([
      "Challenge rating: 2",
    ]);
  });

  it("falls back to a grunt row when no enemy is playable", () => {
    const { ui } = open([]);
    expect(ui.rows.map((r) => r.enemyId)).toEqual(["grunt"]);
  });

  it("tapping a row's name toggles it and updates the challenge rating", () => {
    const { tapRow, selected, ui } = open();
    tapRow("charger"); // archer 1x2 + charger 3x2
    expect(selected()).toEqual(["archer", "charger"]);
    expect(ui.challengeRatingText.last("setText")).toEqual([
      "Challenge rating: 8",
    ]);
    tapRow("archer");
    expect(selected()).toEqual(["charger"]);
  });

  it("dragging the list scrolls instead of toggling, and taps on the steppers column are ignored", () => {
    const { listGesture, rowY, selected, ui } = open();
    listGesture(20, rowY("bruiser"), 40);
    expect(selected()).toEqual(["archer"]);
    listGesture(ui.scroll.view.layout.numericColLeft + 5, rowY("bruiser"));
    expect(selected()).toEqual(["archer"]);
  });

  it("steppers bump count and timings in 100 ms steps, clamped at their minimums", () => {
    const { bump, row, ui } = open();
    bump("archer", "count", "minus", 3);
    expect(row("archer").values.count.last("setText")).toEqual(["1"]);
    bump("archer", "count", "plus", 2);
    expect(row("archer").values.count.last("setText")).toEqual(["3"]);
    expect(ui.challengeRatingText.last("setText")).toEqual([
      "Challenge rating: 3",
    ]);
    bump("archer", "atMs", "minus");
    expect(row("archer").values.atMs.last("setText")).toEqual(["0"]);
    bump("archer", "atMs", "plus", 3);
    expect(row("archer").values.atMs.last("setText")).toEqual(["300"]);
    bump("archer", "intervalMs", "plus");
    expect(row("archer").values.intervalMs.last("setText")).toEqual(["900"]);
  });

  it("Start sends one group per selected enemy and closes the panel", () => {
    const { tapRow, bump, tapButton, ui, onStart, onDismiss } = open();
    tapRow("grunt");
    bump("grunt", "count", "plus", 4);
    bump("grunt", "intervalMs", "minus", 3);
    tapButton(ui.startBtn.container);
    expect(onStart).toHaveBeenCalledWith([
      { enemyId: "archer", count: 2, atMs: 0, intervalMs: 800 },
      { enemyId: "grunt", count: 6, atMs: 0, intervalMs: 500 },
    ]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(ui.root.destroyed).toBe(true);
    expect(ui.maskGraphics.destroyed).toBe(true);
  });

  it("Start does nothing with no enemy selected", () => {
    const { tapRow, tapButton, ui, onStart, onDismiss } = open();
    tapRow("archer");
    tapButton(ui.startBtn.container);
    expect(onStart).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("Close dismisses without starting, and teardown runs only once", () => {
    const { panel, tapButton, ui, onStart, onDismiss } = open();
    tapButton(ui.closeBtn.container);
    panel.destroy();
    expect(onStart).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("exposes Start / Close tap targets on screen", () => {
    const { panel } = open();
    const t = panel.e2eTapTargets();
    for (const id of ["wave-planner-start", "wave-planner-close"]) {
      expect(t[id]!.x).toBeGreaterThan(0);
      expect(t[id]!.x).toBeLessThan(540);
      expect(t[id]!.y).toBeGreaterThan(0);
      expect(t[id]!.y).toBeLessThan(1200);
    }
  });
});
