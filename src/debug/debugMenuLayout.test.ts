import { describe, expect, it } from "vitest";
import { type DebugMenuItem, layoutDebugMenu } from "./debugMenuLayout";

const noSafe = { top: 0, right: 0, bottom: 0, left: 0 };
const items: DebugMenuItem[] = [
  { kind: "section", label: "OVERLAYS" },
  ...["hitboxes", "ranges", "touch", "paths", "fps"].map((id) => ({
    kind: "row" as const,
    id,
  })),
  { kind: "section", label: "GRAPHICS" },
  ...["filter", "cam", "renderer", "autoround", "world", "fullscreen"].map(
    (id) => ({ kind: "row" as const, id }),
  ),
  { kind: "section", label: "CHEATS" },
  { kind: "row", id: "gold" },
  { kind: "row", id: "talents" },
];

describe("layoutDebugMenu", () => {
  it("keeps the title, Hitboxes and footer on screen at 540×1200", () => {
    const l = layoutDebugMenu(540, 1200, noSafe, items);
    expect(l.titleY).toBeGreaterThan(0);
    expect(l.y.hitboxes).toBeGreaterThan(l.titleY);
    expect(l.y.talents).toBeLessThan(l.footerY - 40);
    expect(l.footerY + 30).toBeLessThanOrEqual(1200);
    expect(l.rowH).toBe(50);
  });

  it("respects safe insets and squeezes rows on short screens", () => {
    const safe = { ...noSafe, top: 44, bottom: 34 };
    const l = layoutDebugMenu(540, 700, safe, items);
    expect(l.sheet.y).toBe(64);
    expect(l.rowH).toBeLessThan(50);
    expect(l.y.talents).toBeLessThan(l.footerY - 30);
    expect(l.footerY + 30).toBeLessThanOrEqual(700 - 34);
    expect(l.y["section:0"]).toBeGreaterThan(l.titleY);
  });
});
