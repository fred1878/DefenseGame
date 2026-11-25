import { describe, expect, it, vi } from "vitest";
import { DataStore } from "../core/DataStore";
import { shippedEnemyCombat } from "../test/shippedEnemyCombat";
import { fakeEventData, fakePointer } from "../test/fakeInput";
import { asScene, fakeScene, type FakeGameObject } from "../test/fakeScene";
import { EndlessModePanel } from "./EndlessModePanel";

function store(ids: string[]) {
  const s = new DataStore();
  s.enemies = Object.fromEntries(
    ids.map((id, i) => [
      id,
      {
        hp: 10,
        speedWu: 1,
        damage: 1,
        weight: 100,
        behavior: "meleeChaser",
        textureKey: `enemy_${id}`,
        displayName: id.toUpperCase(),
        challengeRating: i + 1,
        bodyRadiusWu: 14,
        combat: shippedEnemyCombat("grunt"),
      },
    ]),
  ) as DataStore["enemies"];
  s.player = { endlessPanelDefaultConcurrent: 2 } as DataStore["player"];
  s.waves = {
    "1": { rewardGold: 1, groups: ids.map((enemyId) => ({ atMs: 0, enemyId, count: 1, intervalMs: 0 })) },
  } as DataStore["waves"];
  return s;
}

type Row = {
  enemyId: string;
  bg: FakeGameObject;
  check: FakeGameObject;
  capPlus: FakeGameObject;
  capMinus: FakeGameObject;
  capValue: FakeGameObject;
};
const ids = ["archer", "bruiser", "charger", "grunt", "lobber", "skirmisher", "ward", "zealot"];
const pointer = (id = 1, y = 0) => ({ ...fakePointer(0, y, id), event: fakeEventData() });

function open(enemyIds = ids) {
  const scene = fakeScene();
  const onStart = vi.fn();
  const onDismiss = vi.fn();
  const panel = new EndlessModePanel(asScene(scene), store(enemyIds), onStart, onDismiss);
  const rows = (panel as unknown as { rows: Row[] }).rows;
  const ui = panel as unknown as {
    startBtn: { container: FakeGameObject };
    closeBtn: { container: FakeGameObject };
    challengeRatingText: FakeGameObject;
    infiniteHpBg: FakeGameObject;
    infiniteHpCheck: FakeGameObject;
    root: FakeGameObject;
  };
  const row = (id: string) => rows.find((r) => r.enemyId === id)!;
  const tapRow = (id: string) => {
    row(id).bg.emit("pointerdown", pointer());
    scene.input.emit("pointerup", pointer());
  };
  const tapButton = (c: FakeGameObject) => {
    c.emit("pointerdown", fakePointer(0, 0, 1), 0, 0, fakeEventData());
    scene.input.hitTestPointer.mockReturnValueOnce([c]);
    scene.input.emit("pointerup", fakePointer(0, 0, 1));
  };
  return { scene, panel, onStart, onDismiss, rows, ui, row, tapRow, tapButton };
}

describe("EndlessModePanel", () => {
  it("lists playable enemies in order with the first preselected at the default cap", () => {
    const { panel, rows, row, ui } = open();
    expect(panel.e2eRosterEnemyIds()).toEqual(ids);
    expect(rows.map((r) => r.enemyId)).toEqual(ids);
    expect(panel.e2eSelectedEnemyIds()).toEqual(["archer"]);
    expect(panel.e2eSelectedEnemyId()).toBe("archer");
    expect(row("archer").check.last("setText")).toEqual(["☑"]);
    expect(row("grunt").check.last("setText")).toEqual(["☐"]);
    expect(panel.e2eEnemyConcurrentCap("grunt")).toBe(2);
    // archer CR 1 x cap 2
    expect(ui.challengeRatingText.last("setText")).toEqual(["Challenge rating: 2"]);
    expect(panel.e2eInfiniteHpEnabled()).toBe(true);
  });

  it("falls back to a grunt row when no enemies are playable", () => {
    const { panel } = open([]);
    expect(panel.e2eRosterEnemyIds()).toEqual(["grunt"]);
  });

  it("tapping rows toggles selection, updates CR and enables/disables Start", () => {
    const { panel, tapRow, ui, row } = open();
    tapRow("bruiser"); // CR 2 x 2
    expect(panel.e2eSelectedEnemyIds()).toEqual(["archer", "bruiser"]);
    expect(ui.challengeRatingText.last("setText")).toEqual(["Challenge rating: 6"]);
    expect(row("bruiser").bg.last("setFillStyle")).toEqual([0x1e3a5f]);
    tapRow("archer");
    tapRow("bruiser");
    expect(panel.e2eSelectedEnemyIds()).toEqual([]);
    expect(ui.startBtn.container.alpha).toBe(0.45);
    expect(ui.startBtn.container.callsTo("disableInteractive")).toHaveLength(1);
    expect(row("archer").capPlus.alpha).toBe(0.65);
    tapRow("grunt");
    expect(ui.startBtn.container.alpha).toBe(1);
  });

  it("a drag on a row scrolls instead of toggling", () => {
    const { panel, scene, row } = open();
    row("charger").bg.emit("pointerdown", pointer(1, 300));
    scene.input.emit("pointermove", pointer(1, 200));
    scene.input.emit("pointerup", pointer(1, 200));
    expect(panel.e2eSelectedEnemyIds()).toEqual(["archer"]);
    expect(panel.e2eEnemyListScrollState().scrollY).toBeGreaterThan(0);
  });

  it("cap +/- buttons clamp between 1 and 99 and feed the challenge rating", () => {
    const { panel, row, ui } = open();
    const archer = row("archer");
    archer.capPlus.emit("pointerup", pointer());
    expect(panel.e2eEnemyConcurrentCap("archer")).toBe(3);
    expect(archer.capValue.last("setText")).toEqual(["3"]);
    expect(ui.challengeRatingText.last("setText")).toEqual(["Challenge rating: 3"]);
    for (let i = 0; i < 5; i++) archer.capMinus.emit("pointerup", pointer());
    expect(panel.e2eEnemyConcurrentCap("archer")).toBe(1);
    panel.e2eSetEnemyCap("archer", 500);
    expect(panel.e2eEnemyConcurrentCap("archer")).toBe(99);
  });

  it("the infinite HP row toggles its checkbox", () => {
    const { panel, ui } = open();
    ui.infiniteHpBg.emit("pointerup");
    expect(panel.e2eInfiniteHpEnabled()).toBe(false);
    expect(ui.infiniteHpCheck.last("setText")).toEqual(["☐"]);
    panel.e2eSetInfiniteHp(false);
    expect(ui.infiniteHpCheck.callsTo("setText")).toHaveLength(2);
    panel.e2eSetInfiniteHp(true);
    expect(ui.infiniteHpCheck.last("setText")).toEqual(["☑"]);
  });

  it("Start passes the selections and HP mode, then tears the panel down once", () => {
    const { onStart, onDismiss, tapRow, tapButton, ui, row } = open();
    tapRow("grunt");
    row("grunt").capPlus.emit("pointerup", pointer());
    ui.infiniteHpBg.emit("pointerup");
    tapButton(ui.startBtn.container);
    expect(onStart).toHaveBeenCalledWith(
      [
        { enemyId: "archer", concurrentCap: 2 },
        { enemyId: "grunt", concurrentCap: 3 },
      ],
      false,
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(ui.root.destroyed).toBe(true);
  });

  it("Start does nothing with an empty selection; Close dismisses without starting", () => {
    const { onStart, onDismiss, tapRow, tapButton, ui, panel } = open();
    tapRow("archer");
    // Start is disabled visually; even if the handler runs it must not start.
    tapButton(ui.startBtn.container);
    expect(onStart).not.toHaveBeenCalled();
    tapButton(ui.closeBtn.container);
    expect(onStart).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    panel.destroy();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("e2eStartWithEnemy starts with only that enemy at the default cap", () => {
    const { panel, onStart } = open();
    panel.e2eStartWithEnemy("ward", true);
    expect(onStart).toHaveBeenCalledWith([{ enemyId: "ward", concurrentCap: 2 }], true);
  });

  it("8 rows overflow 6 visible: list scrolls and clamps at the end", () => {
    const { panel } = open();
    const state = panel.e2eEnemyListScrollState();
    expect(state.maxVisibleRows).toBe(6);
    expect(state.scrollbarVisible).toBe(true);
    panel.e2eScrollEnemyList(10_000);
    expect(panel.e2eEnemyListScrollState().scrollY).toBe(state.maxScroll);
    panel.e2eScrollEnemyList(-20_000);
    expect(panel.e2eEnemyListScrollState().scrollY).toBe(0);
    const footer = panel.e2eFooterLayout();
    expect(footer.infiniteHpY).toBeLessThan(footer.challengeRatingY);
    expect(footer.challengeRatingY).toBeLessThan(footer.startY);
  });

  it("exposes e2e tap targets and touch-debug rects for every control", () => {
    const { panel } = open(["grunt", "skirmisher"]);
    const targets = panel.e2eTapTargets();
    const rects = panel.touchDebugScreenRects();
    for (const id of ["grunt", "skirmisher"]) {
      for (const kind of ["enemy", "cap-minus", "cap-plus"]) {
        const key = kind === "enemy" ? `endless-enemy-${id}` : `endless-${kind}-${id}`;
        const t = targets[key]!;
        expect(t, key).toBeDefined();
        // Every e2e tap point lands inside a touch-debug outline.
        expect(
          rects.some((r) => t.x >= r.x && t.x <= r.x + r.width && t.y >= r.y && t.y <= r.y + r.height),
          key,
        ).toBe(true);
      }
      expect(targets[`endless-cap-minus-${id}`]!.x).toBeLessThan(targets[`endless-cap-plus-${id}`]!.x);
    }
    expect(targets["endless-infinite-hp"]!.y).toBeLessThan(targets["endless-challenge-rating"]!.y);
    // viewport + (name, cap column, minus, plus) per visible row
    expect(rects).toHaveLength(1 + 2 * 4);
  });
});
