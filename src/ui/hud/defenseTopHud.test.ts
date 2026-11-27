import { describe, expect, it } from "vitest";
import { asScene, fakeScene, type FakeGameObject } from "../../test/fakeScene";
import {
  barRatio,
  createDefenseTopHud,
  defenseTopHudLayout,
  formatSpawnProgress,
  splitHudHeader,
} from "./defenseTopHud";

describe("defenseTopHud", () => {
  it("lays out crest row, bars and progress inside the band", () => {
    const L = defenseTopHudLayout(540, 20, 146);
    expect(L.top).toBe(20);
    expect(L.height).toBe(126);
    expect(L.debugX + L.debugW).toBe(540 - L.pad);
    expect(L.enemiesX + L.enemiesW).toBeLessThan(L.debugX);
    expect(L.barsY).toBeGreaterThan(L.row1Y + 40);
    expect(L.progressY).toBeGreaterThan(L.barsY + L.barH);
    expect(L.progressY + 14).toBeLessThanOrEqual(L.top + L.height);
    expect(defenseTopHudLayout(540, 0, 10).height).toBe(96);
  });

  it("formats ratios, spawn progress and headers", () => {
    expect(barRatio(5, 10)).toBe(0.5);
    expect(barRatio(20, 10)).toBe(1);
    expect(barRatio(-1, 10)).toBe(0);
    expect(barRatio(1, 0)).toBe(0);
    expect(formatSpawnProgress(3, 9)).toBe("3/9 spawned");
    expect(formatSpawnProgress(12, 9)).toBe("9/9 spawned");
    expect(formatSpawnProgress(0, 0)).toBe("");
    expect(splitHudHeader("Night 6", "Campaign")).toEqual({
      title: "Night 6",
      subtitle: "Campaign",
    });
    expect(splitHudHeader("Endless · Ghoul +1", "x")).toEqual({
      title: "Endless",
      subtitle: "Ghoul +1",
    });
  });

  it("updates texts and bar fills, and hides everything", () => {
    const scene = fakeScene();
    const hud = createDefenseTopHud(
      asScene(scene),
      defenseTopHudLayout(540, 0, 126),
    );
    hud.update({
      title: "Night 6",
      subtitle: "Campaign",
      livingEnemies: 12,
      wallHp: 74,
      wallHpMax: 100,
      playerHp: 0,
      playerHpMax: 136,
      heroTag: " ∞",
      spawned: 17,
      spawnTotal: 29,
    });
    const texts = hud.roots
      .map((r) => (r as unknown as FakeGameObject).last?.("setText")?.[0])
      .filter(Boolean);
    expect(texts).toEqual(
      expect.arrayContaining([
        "Night 6",
        "Campaign",
        "12",
        "74/100",
        "0/136 ∞",
        "17/29 spawned",
        "ENEMIES",
      ]),
    );
    hud.setVisible(false);
    expect(
      hud.roots.every(
        (r) => (r as unknown as FakeGameObject).visible === false,
      ),
    ).toBe(true);
  });
});
